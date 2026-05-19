import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC0L5t-kSbn_hhFvHxyRxh8AMTMapoS0PE",
  authDomain: "heli-court.firebaseapp.com",
  projectId: "heli-court",
  storageBucket: "heli-court.firebasestorage.app",
  messagingSenderId: "1033654721781",
  appId: "1:1033654721781:web:727447ab6b7acca3a1f9bc",
  measurementId: "G-19FBSB7T10"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COURTS = [
  { id: 1, name: "Badminton Court", type: "Badminton", surface: "Synthetic" },
];

const SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00", "21:00",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COURT_COLORS = {
  1: { accent: "#0277bd", light: "#b3e5fc" },
};

function getWeekDates(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateKey(date) {
  return date.toISOString().split("T")[0];
}

function isTodayOrFuture(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

function isToday(date) {
  const today = new Date();
  return dateKey(date) === dateKey(today);
}

function canBookNow() {
  // Users can only make bookings starting from 8:00am real time
  const now = new Date();
  return now.getHours() >= 8;
}

export default function CourtBookingSystem() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCourt] = useState(1);
  const [bookings, setBookings] = useState({});  // key -> { id (firestore doc id), player, courtId, date, slot }
  const [modal, setModal] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [view, setView] = useState("grid");
  const [userName, setUserName] = useState("");
  const [welcomeName, setWelcomeName] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [toast, setToast] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  const SPECIAL_NAMES = ["timun", "peruz", "tambun", "aiman fairuz", "aiman", "fairuz", "ateman", "tairuz", "eman", "man"];
  const isSpecialName = (name) => SPECIAL_NAMES.includes(name.trim().toLowerCase());

  const weekDates = getWeekDates(weekOffset);
  const court = COURTS[0];
  const colors = COURT_COLORS[1];

  // Real-time listener from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const data = {};
      snapshot.forEach((docSnap) => {
        const b = docSnap.data();
        const key = `${b.courtId}_${b.date}_${b.slot}`;
        data[key] = { ...b, firestoreId: docSnap.id };
      });
      setBookings(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function bookingKey(courtId, date, slot) {
    return `${courtId}_${dateKey(date)}_${slot}`;
  }

  function openBook(date, slot) {
    if (!isToday(date)) {
      showToast("⚠ You can only book for today!");
      return;
    }

    // 8am restriction
    if (!canBookNow()) {
      showToast("⚠ Bookings open at 8:00 AM daily!");
      return;
    }

    const key = bookingKey(selectedCourt, date, slot);
    if (bookings[key]) {
      if (bookings[key].player !== userName) {
        showToast("⚠ You can only cancel your own booking!");
        return;
      }
      setModal({ mode: "cancel", bookingKey: key, date, slot });
    } else {
      setPlayerName(userName);
      setModal({ mode: "book", bookingKey: key, date, slot });
    }
  }

  async function confirmBooking() {
    if (!playerName.trim()) return;
    if (isSpecialName(playerName) && !uploadedImage) {
      showToast("⚠ Please upload your statistics tutorial picture first!");
      return;
    }

    const bookingData = {
      player: playerName,
      courtId: selectedCourt,
      date: dateKey(modal.date),
      slot: modal.slot,
      image: uploadedImage || null,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "bookings"), bookingData);
      setUploadedImage(null);
      setModal(null);
      showToast(`✓ Court booked for ${modal.slot}!`);
    } catch (e) {
      showToast("❌ Failed to book. Try again.");
    }
  }

  async function confirmCancel() {
    const booking = bookings[modal.bookingKey];
    if (!booking?.firestoreId) return;
    try {
      await deleteDoc(doc(db, "bookings", booking.firestoreId));
      setModal(null);
      showToast("Booking cancelled.");
    } catch (e) {
      showToast("❌ Failed to cancel. Try again.");
    }
  }

  async function cancelBookingByKey(key) {
    const booking = bookings[key];
    if (!booking?.firestoreId) return;
    try {
      await deleteDoc(doc(db, "bookings", booking.firestoreId));
      showToast("Booking cancelled.");
    } catch (e) {
      showToast("❌ Failed to cancel. Try again.");
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function myBookings() {
    return Object.entries(bookings)
      .filter(([, b]) => b.player === userName)
      .sort(([, a], [, b2]) => new Date(a.date) - new Date(b2.date));
  }

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [weekOffset]);

  const totalBookings = Object.keys(bookings).length;

  // Welcome screen
  if (showWelcome) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: "#f0ede8",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          textAlign: "center", padding: 48, maxWidth: 420, width: "100%",
          animation: "fadeIn 0.5s ease",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏸</div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#0277bd", textTransform: "uppercase", marginBottom: 8 }}>Welcome to</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Taman Heliconia</div>
          <div style={{ fontSize: 13, color: "#ffffff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Court Booking</div>
          <div style={{ fontSize: 12, color: "#444", fontStyle: "italic", marginBottom: 40 }}>Siapa cepat, Dia dapat</div>

          <div style={{ textAlign: "left", marginBottom: 12 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>Enter your name to continue</label>
            <input
              value={welcomeName}
              onChange={(e) => setWelcomeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && welcomeName.trim()) {
                  setUserName(welcomeName.trim());
                  setShowWelcome(false);
                }
              }}
              autoFocus
              placeholder="Your name..."
              style={{
                display: "block", width: "100%", marginTop: 10,
                background: "#1a1a1a", border: "1px solid #333",
                color: "#f0ede8", padding: "14px 16px",
                fontSize: 16, borderRadius: 2, outline: "none",
                fontFamily: "inherit", boxSizing: "border-box",
                letterSpacing: 1,
              }}
            />
          </div>

          <button
            onClick={() => {
              if (!welcomeName.trim()) return;
              setUserName(welcomeName.trim());
              setShowWelcome(false);
            }}
            style={{
              width: "100%", padding: "14px",
              background: welcomeName.trim() ? "#0277bd" : "#1a1a1a",
              color: welcomeName.trim() ? "#fff" : "#444",
              border: `1px solid ${welcomeName.trim() ? "#0277bd" : "#222"}`,
              borderRadius: 2, cursor: welcomeName.trim() ? "pointer" : "default",
              fontSize: 13, letterSpacing: 3, textTransform: "uppercase",
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            Enter
          </button>

          <div style={{ marginTop: 24, fontSize: 11, color: "#333" }}>
            ⏰ Bookings open daily from <span style={{ color: "#0277bd" }}>8:00 AM</span>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f0ede8",
      overflowX: "hidden",
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          background: "#1a1a1a", border: "1px solid #4caf50",
          color: "#a5d6a7", padding: "12px 24px", borderRadius: 4,
          fontFamily: "monospace", fontSize: 14, letterSpacing: 1,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          animation: "slideIn 0.3s ease",
        }}>
          {toast}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)",
        }} onClick={() => { setModal(null); setUploadedImage(null); }}>
          <div style={{
            background: "#111", border: `1px solid ${colors.accent}`,
            borderRadius: 2, padding: 40, minWidth: 340, maxWidth: 420,
            boxShadow: `0 0 60px ${colors.accent}33`,
          }} onClick={(e) => e.stopPropagation()}>
            {modal.mode === "book" ? (
              <>
                <div style={{ fontSize: 11, letterSpacing: 3, color: colors.accent, marginBottom: 8, textTransform: "uppercase" }}>Reserve Court</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{court.name}</div>
                <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
                  {modal.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {modal.slot}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, letterSpacing: 2, color: "#666", textTransform: "uppercase" }}>Player Name</label>
                  <input
                    value={playerName}
                    onChange={(e) => { setPlayerName(e.target.value); setUploadedImage(null); }}
                    onKeyDown={(e) => e.key === "Enter" && confirmBooking()}
                    autoFocus
                    style={{
                      display: "block", width: "100%", marginTop: 8,
                      background: "#1a1a1a", border: "1px solid #333",
                      color: "#f0ede8", padding: "10px 14px",
                      fontSize: 15, borderRadius: 2, outline: "none",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>

                {isSpecialName(playerName) && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, letterSpacing: 2, color: "#f0a500", textTransform: "uppercase" }}>
                      📎 Upload Statistics Tutorial Picture <span style={{ color: "#e57373" }}>*Required</span>
                    </label>
                    <div
                      onClick={() => document.getElementById("stat-upload").click()}
                      style={{
                        marginTop: 10, border: `2px dashed ${uploadedImage ? colors.accent : "#555"}`,
                        borderRadius: 4, padding: "16px", textAlign: "center", cursor: "pointer",
                        background: uploadedImage ? colors.accent + "11" : "#1a1a1a",
                        transition: "all 0.2s",
                      }}
                    >
                      {uploadedImage ? (
                        <div>
                          <img src={uploadedImage} alt="preview" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 4, objectFit: "cover" }} />
                          <div style={{ fontSize: 11, color: "#a5d6a7", marginTop: 6 }}>✓ Image uploaded — click to change</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                          <div style={{ fontSize: 12, color: "#777" }}>Click to upload your statistics tutorial picture</div>
                        </div>
                      )}
                    </div>
                    <input
                      id="stat-upload" type="file" accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setUploadedImage(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={confirmBooking} style={{
                    flex: 1, padding: "12px", background: colors.accent,
                    color: "#fff", border: "none", borderRadius: 2, cursor: "pointer",
                    fontSize: 13, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
                  }}>Confirm</button>
                  <button onClick={() => { setModal(null); setUploadedImage(null); }} style={{
                    flex: 1, padding: "12px", background: "transparent",
                    color: "#888", border: "1px solid #333", borderRadius: 2, cursor: "pointer",
                    fontSize: 13, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
                  }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#e57373", marginBottom: 8, textTransform: "uppercase" }}>Cancel Booking</div>
                <div style={{ fontSize: 18, marginBottom: 8 }}>
                  {bookings[modal.bookingKey]?.player} · {court.name}
                </div>
                <div style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>
                  {modal.date?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {modal.slot}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={confirmCancel} style={{
                    flex: 1, padding: "12px", background: "#c62828",
                    color: "#fff", border: "none", borderRadius: 2, cursor: "pointer",
                    fontSize: 13, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
                  }}>Cancel Booking</button>
                  <button onClick={() => setModal(null)} style={{
                    flex: 1, padding: "12px", background: "transparent",
                    color: "#888", border: "1px solid #333", borderRadius: 2, cursor: "pointer",
                    fontSize: 13, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
                  }}>Keep It</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222",
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,20,0.95)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", fontWeight: 700 }}>Taman Heliconia</span>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: 3, textTransform: "uppercase" }}>Court Booking</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button
            onClick={() => setView(view === "grid" ? "my-bookings" : "grid")}
            style={{
              background: "none", border: "1px solid #333", color: "#aaa",
              padding: "6px 18px", borderRadius: 2, cursor: "pointer",
              fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
            }}
          >
            {view === "grid" ? `My Bookings (${myBookings().length})` : "← Grid"}
          </button>
          <div style={{ fontSize: 13, color: "#555" }}>
            <span style={{ color: "#888" }}>Playing as </span>
            <span style={{ color: "#f0ede8" }}>{userName}</span>
          </div>
        </div>
      </div>

      {/* 8am notice banner */}
      {!canBookNow() && (
        <div style={{
          background: "#1a1200", borderBottom: "1px solid #3a2e00",
          padding: "10px 32px", fontSize: 12, color: "#f0a500",
          textAlign: "center", letterSpacing: 1,
        }}>
          ⏰ Bookings are closed right now. They open every day at <strong>8:00 AM</strong>.
        </div>
      )}

      {view === "my-bookings" ? (
        <div style={{ padding: "40px 32px", maxWidth: 700, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>Your Schedule</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 32 }}>My Bookings</div>
          {myBookings().length === 0 ? (
            <div style={{ color: "#444", fontSize: 16, padding: "60px 0", textAlign: "center", borderTop: "1px solid #1a1a1a" }}>
              No bookings yet. Head to the grid to reserve a court.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myBookings().map(([key, b]) => {
                const col = COURT_COLORS[b.courtId];
                return (
                  <div key={key} style={{
                    background: "#111", border: "1px solid #222",
                    borderLeft: `3px solid ${col.accent}`,
                    padding: "20px 24px", borderRadius: 2,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{court.name} · {b.slot}</div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                        {new Date(b.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                      </div>
                    </div>
                    <button onClick={() => cancelBookingByKey(key)} style={{
                      background: "none", border: "1px solid #333", color: "#666",
                      padding: "6px 14px", cursor: "pointer", borderRadius: 2,
                      fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit",
                    }}>
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "32px" }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 13, letterSpacing: 2 }}>
              Loading bookings...
            </div>
          )}

          {/* Week nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <button onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0}
              style={{ background: "none", border: "1px solid #222", color: weekOffset === 0 ? "#2a2a2a" : "#888", padding: "6px 14px", cursor: weekOffset === 0 ? "default" : "pointer", borderRadius: 2, fontFamily: "inherit", fontSize: 18 }}>
              ←
            </button>
            <div style={{ fontSize: 14, color: "#888", letterSpacing: 2 }}>
              {weekDates[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {" — "}
              {weekDates[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <button onClick={() => setWeekOffset((w) => Math.min(3, w + 1))} disabled={weekOffset === 3}
              style={{ background: "none", border: "1px solid #222", color: weekOffset === 3 ? "#2a2a2a" : "#888", padding: "6px 14px", cursor: weekOffset === 3 ? "default" : "pointer", borderRadius: 2, fontFamily: "inherit", fontSize: 18 }}>
              →
            </button>
          </div>

          {/* Booking grid */}
          <div key={animKey} style={{
            overflowX: "auto", border: "1px solid #1a1a1a",
            borderRadius: 2, animation: "fadeIn 0.3s ease",
          }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, letterSpacing: 2, color: "#444", textTransform: "uppercase", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", width: 70 }}>Time</th>
                  {weekDates.map((date, i) => {
                    const isToday = dateKey(date) === dateKey(new Date());
                    const past = !isTodayOrFuture(date);
                    return (
                      <th key={i} style={{
                        padding: "14px 8px", textAlign: "center",
                        fontSize: 12, background: "#0a0a0a",
                        borderBottom: "1px solid #1a1a1a",
                        borderLeft: "1px solid #1a1a1a",
                        color: isToday ? colors.accent : past ? "#2a2a2a" : "#666",
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        <div style={{ letterSpacing: 2, textTransform: "uppercase", fontSize: 10 }}>{DAYS[i]}</div>
                        <div style={{ fontSize: 16, marginTop: 2 }}>{date.getDate()}</div>
                        {isToday && <div style={{ width: 4, height: 4, background: colors.accent, borderRadius: "50%", margin: "4px auto 0" }} />}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td style={{
                      padding: "0 16px", fontSize: 12, color: "#444",
                      background: "#0a0a0a", borderBottom: "1px solid #111",
                      fontVariantNumeric: "tabular-nums", letterSpacing: 1,
                      height: 44,
                    }}>{slot}</td>
                    {weekDates.map((date, di) => {
                      const key = bookingKey(selectedCourt, date, slot);
                      const booked = bookings[key];
                      const past = !isTodayOrFuture(date);
                      const notToday = !isToday(date);
                      const isMyBooking = booked?.player === userName;
                      return (
                        <td key={di} style={{
                          padding: "4px 6px",
                          borderBottom: "1px solid #111",
                          borderLeft: "1px solid #111",
                          height: 44,
                        }}>
                          <div
                            onClick={() => !past && openBook(date, slot)}
                            style={{
                              height: "100%", minHeight: 36,
                              borderRadius: 2, cursor: past ? "default" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, letterSpacing: 1,
                              transition: "all 0.15s",
                              ...(past
                                ? { background: "#0d0d0d", color: "#222" }
                                : notToday
                                ? { background: "#0d0d0d", color: "#1e1e1e", cursor: "not-allowed" }
                                : booked
                                ? {
                                    background: isMyBooking ? colors.accent : "#1a1a1a",
                                    border: `1px solid ${isMyBooking ? colors.accent : "#333"}`,
                                    color: isMyBooking ? "#fff" : "#555",
                                  }
                                : {
                                    background: "#111",
                                    border: "1px solid #1a1a1a",
                                    color: "#333",
                                  }),
                            }}
                            onMouseEnter={(e) => {
                              if (!past && !notToday && !booked) {
                                e.currentTarget.style.background = colors.light + "22";
                                e.currentTarget.style.borderColor = colors.accent + "66";
                                e.currentTarget.style.color = colors.accent;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!past && !notToday && !booked) {
                                e.currentTarget.style.background = "#111";
                                e.currentTarget.style.borderColor = "#1a1a1a";
                                e.currentTarget.style.color = "#333";
                              }
                            }}
                          >
                            {booked
                              ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90, display: "block", textAlign: "center", padding: "0 4px", fontSize: 11 }}>{booked.player}</span>
                              : past || notToday ? "" : "+"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 24, marginTop: 20, fontSize: 11, color: "#444", letterSpacing: 1, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 16, height: 16, background: colors.accent, borderRadius: 2 }} />
              <span>Your booking</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 16, height: 16, background: "#1a1a1a", border: "1px solid #333", borderRadius: 2 }} />
              <span>Booked (name shown)</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 16, height: 16, background: "#111", border: "1px solid #1a1a1a", borderRadius: 2 }} />
              <span>Available</span>
            </div>
            <div style={{ marginLeft: "auto", color: "#333" }}>
              {totalBookings} total booking{totalBookings !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
      `}</style>
    </div>
  );
}