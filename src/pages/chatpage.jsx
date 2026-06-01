import { useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { uploadToCloudinary } from "../utils/cloudinary";
import UserSearch from "../components/UserSearch";
import ContactRequests from "../components/ContactRequests";
import ContactsList from "../components/ContactsList";


const CELESTIALS = ["⭐", "🌟", "✨", "🌙", "☀️", "🌌"];


function getTimeframe() {
    const h = new Date().getHours();
    if (h >= 5 && h < 6) return "sunrise";
    if (h >= 6 && h < 11) return "morning";
    if (h >= 11 && h < 13) return "midday";
    if (h >= 13 && h < 18) return "afternoon";
    if (h >= 18 && h < 19) return "sunset";
    return "night";
}


function getColors() {
    const t = getTimeframe();


    return {
        sunrise: ["#ff4d8d", "#ffb86b"],
        morning: ["#ffd36b", "#4de1ff"],
        midday: ["#ffffff", "#6bbcff"],
        afternoon: ["#ff9a3c", "#b36bff"],
        sunset: ["#ff3d5e", "#ff7ad9"],
        night: ["#4d6bff", "#b84dff"],
    }[t];
}


export default function ChatPage({ user }) {
    const [users, setUsers] = useState(["atlas", "luna", "nova", "orion"]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [search, setSearch] = useState("");
    const [isTyping, setIsTyping] = useState(false);
const typingTimeoutRef = useRef(null);
const [deleteTarget, setDeleteTarget] = useState(null);
    // Tab and selection states
    const [sidebarTab, setSidebarTab] = useState("nodes"); // "nodes" or "contacts"
    const [selectedUser, setSelectedUser] = useState("atlas"); // node selection
    const [selectedContact, setSelectedContact] = useState(null); // contact selection
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [energy, setEnergy] = useState(30);
    const [uploading, setUploading] = useState(false);


    // Resolve unified Chat Room / Node collection ID
    const activeChatId = selectedContact
        ? (user.uid < selectedContact.uid ? `${user.uid}_${selectedContact.uid}` : `${selectedContact.uid}_${user.uid}`)
        : selectedUser;








    function renameUser(oldName) {
        setEditingUser(oldName);
        setEditValue(oldName);
    }








    function saveRename(oldName) {
        setUsers((prev) =>
            prev.map((u) => (u === oldName ? editValue : u))
        );
        if (selectedUser === oldName) {
            setSelectedUser(editValue);
        }
        setEditingUser(null);
    }








    const [celestials, setCelestials] = useState([]);
    const canvasRef = useRef(null);
    const imageInputRef = useRef(null);
    const historyRef = useRef([]);
    const moodRef = useRef("calm");
    const [hoveredMessage, setHoveredMessage] = useState(null);
    const [c1, c2] = getColors();








    /* ---------------- FIREBASE FIRESTORE SYNC ---------------- */
    useEffect(() => {
        if (!activeChatId) return;








        const q = query(
            collection(db, "chats", activeChatId, "messages"),
            orderBy("time", "asc")
        );








        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            setMessages(list);
        }, (error) => {
            console.error("Firestore snapshot reading error:", error);
        });








        return () => unsubscribe();
    }, [activeChatId]);








    /* ---------------- CANVAS ENGINE (NO FLICKER CORE FIX) ---------------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);
        let frame;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const history = historyRef.current;
            const mood = moodRef.current;
            if (history.length > 1) {
                ctx.strokeStyle =
                    mood === "bloom"
                        ? "rgba(255,255,255,0.8)"
                        : mood === "storm"
                            ? "rgba(255,100,255,0.8)"
                            : "rgba(180,120,255,0.4)";
                ctx.shadowBlur = 12;
                ctx.shadowColor = "#b84dff";
                for (let i = 0; i < history.length - 1; i++) {
                    const a = history[i];
                    const b = history[i + 1];
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
            frame = requestAnimationFrame(render);
        };
        render();
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", resize);
        };
    }, []);








    /* ---------------- MESSAGE ---------------- */
    async function sendMessage() {
        if (!input.trim() || !activeChatId) return;
        if (CELESTIALS.includes(input.trim())) {
            spawnStar(input.trim());
            setInput("");
            return;
        }
       
        const textToSend = input.trim();
        setInput("");








        try {
            await addDoc(collection(db, "chats", activeChatId, "messages"), {
                text: textToSend,
                type: "text",
                time: Date.now(),
                senderId: user?.uid || "anonymous",
                senderEmail: user?.email || "",
                senderName: user?.displayName || user?.email?.split("@")[0] || "Anonymous"
            });
            setEnergy((e) => Math.min(e + 5, 100));
        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(textToSend);
        }
    }


async function deleteMessage(messageId) {
    try {
        await deleteDoc(doc(db, "chats", activeChatId, "messages", messageId));
    } catch (err) {
        console.error("delete failed:", err);
    }
}




    async function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file || !activeChatId) return;








        setUploading(true);
        try {
            const imageUrl = await uploadToCloudinary(file);
            await addDoc(collection(db, "chats", activeChatId, "messages"), {
                image: imageUrl,
                type: "image",
                time: Date.now(),
                senderId: user?.uid || "anonymous",
                senderEmail: user?.email || "",
                senderName: user?.displayName || user?.email?.split("@")[0] || "Anonymous"
            });
            setEnergy((e) => Math.min(e + 5, 100));
        } catch (error) {
            console.error("Failed to upload image:", error);
            alert(error?.message || "Failed to upload image to Cloudinary.");
        } finally {
            setUploading(false);
        }
    }








    const handleSignOut = async () => {
        try {
            if (user) {
                await setDoc(doc(db, "users", user.uid), { status: "offline", lastActive: Date.now() }, { merge: true });
            }
            await signOut(auth);
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    };
















    /* ---------------- STAR SYSTEM ---------------- */
    function spawnStar(symbol) {
        const now = Date.now();
        const star = {
            id: now,
            symbol,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            time: now,
        };
        setCelestials((p) => [...p, star]);
        historyRef.current = [...historyRef.current, star].slice(-40);
        if (historyRef.current.length > 8) moodRef.current = "storm";
        else if (historyRef.current.length > 4) moodRef.current = "active";
        else moodRef.current = "calm";
        setTimeout(() => {
            setCelestials((p) => p.filter((s) => s.id !== star.id));
        }, 6000);
    }
















    /* ---------------- ENERGY ---------------- */
    useEffect(() => {
        const i = setInterval(() => {
            setEnergy((e) => Math.max(e - 1, 0));
        }, 1000);
















        return () => clearInterval(i);
    }, []);
    const [editingUser, setEditingUser] = useState(null);
    const [editValue, setEditValue] = useState("");
















    /* ---------------- MESSAGE DIM LOGIC ---------------- */
    function getMessageOpacity(index) {
        const age = messages.length - index - 1;
        const baseDim = Math.min(age * 0.12, 0.75);
        return 1 - baseDim;
    }
const typingName =
    selectedContact?.displayName ||
    selectedContact?.email?.split("@")[0] ||
    selectedUser;


    return (
        <div
            style={{
                height: "100vh",
                width: "100vw",
                background: "#000",
                position: "relative",
                overflow: "hidden",
                color: "white",
            }}
        >
            {/* 🌌 MOOD FIELD */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        moodRef.current === "storm"
                            ? "radial-gradient(circle, rgba(180,80,255,0.18), transparent 70%)"
                            : moodRef.current === "active"
                                ? "radial-gradient(circle, rgba(120,120,255,0.12), transparent 70%)"
                                : "radial-gradient(circle, rgba(80,80,160,0.08), transparent 70%)",
                    pointerEvents: "none",
                }}
            />
            {/* 🌠 CANVAS */}
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                }}
            />
            {/* ⭐ CELESTIALS */}
            {celestials.map((c) => (
                <div
                    key={c.id}
                    style={{
                        position: "absolute",
                        left: c.x,
                        top: c.y,
                        fontSize: 24,
                        animation: "float 5s ease-out forwards",
                    }}
                >
                    {c.symbol}
                </div>
            ))}
            {/* 🌌 SIDEBAR */}
            <div
                style={{
                    position: "absolute",
                    left: 20,
                    top: 20,
                    bottom: 20,
                    width: 240,
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid ${c1}`,
                    borderRadius: 16,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box"
                }}
            >
                {/* Custom Tab Selector */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button
                        onClick={() => setSidebarTab("nodes")}
                        style={{
                            flex: 1,
                            padding: "6px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                            border: `1px solid ${sidebarTab === "nodes" ? c1 : "rgba(255,255,255,0.1)"}`,
                            background: sidebarTab === "nodes" ? "rgba(255,255,255,0.05)" : "transparent",
                            color: sidebarTab === "nodes" ? "white" : "rgba(255,255,255,0.6)",
                            cursor: "pointer"
                        }}
                    >
                        CHANNELS
                    </button>
                    <button
                        onClick={() => setSidebarTab("contacts")}
                        style={{
                            flex: 1,
                            padding: "6px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                            border: `1px solid ${sidebarTab === "contacts" ? c1 : "rgba(255,255,255,0.1)"}`,
                            background: sidebarTab === "contacts" ? "rgba(255,255,255,0.05)" : "transparent",
                            color: sidebarTab === "contacts" ? "white" : "rgba(255,255,255,0.6)",
                            cursor: "pointer"
                        }}
                    >
                        CONTACTS
                    </button>
                </div>








                {sidebarTab === "nodes" ? (
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: 70 }}>
                        <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 4, letterSpacing: 2 }}>NODES</div>
                        {users.map((u) => (
                            <div
                                key={u}
                                style={{
                                    padding: 10,
                                    marginTop: 8,
                                    borderRadius: 10,
                                    background:
                                        selectedUser === u
                                            ? `linear-gradient(135deg, ${c1}, ${c2})`
                                            : "transparent",
                                    cursor: "pointer"
                                }}
                                onClick={() => {
                                    setSelectedUser(u);
                                    setSelectedContact(null);
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    {editingUser === u ? (
                                        <input
                                            value={editValue}
                                           
                                            onKeyDown={(e) => e.key === "Enter" && saveRename(u)}
                                            style={{
                                                width: "100%",
                                                background: "black",
                                                color: "white",
                                                border: "1px solid white"
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span style={{ cursor: "pointer" }}>
                                            {u}
                                        </span>
                                    )}








                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            renameUser(u);
                                        }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "white" }}
                                    >
                                        ✏️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: 70, display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* Users Search */}
                        <UserSearch currentUser={user} c1={c1} c2={c2} />
                       
                        {/* Incoming Requests */}
                        <ContactRequests currentUser={user} c1={c1} c2={c2} />
                       
                        {/* Contacts List */}
                        <ContactsList
                            currentUser={user}
                            selectedContact={selectedContact}
                            onSelectContact={(contact) => {
                                setSelectedContact(contact);
                                setSelectedUser(null);
                            }}
                            c1={c1}
                            c2={c2}
                        />
                    </div>
                )}








                {/* 🔒 LOGOUT / PROFILE PANEL */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 15,
                        left: 10,
                        right: 10,
                        borderTop: "1px solid rgba(255,255,255,0.15)",
                        paddingTop: 12,
                        fontFamily: "monospace"
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            opacity: 0.5,
                            marginBottom: 6,
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap"
                        }}
                    >
                        ● {user?.displayName || user?.email?.split("@")[0] || "Traveler"}
                    </div>
                    <button
                        onClick={handleSignOut}
                        style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "rgba(255, 77, 141, 0.15)",
                            border: "1px solid #ff4d8d",
                            color: "white",
                            fontSize: "11px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            fontFamily: "monospace"
                        }}
                    >
                        DISCONNECT
                    </button>
                </div>
            </div>
            {/* 🧠 TOP HUD */}
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: `calc(280px + (100% - 280px - ${showRightPanel ? "320px" : "20px"}) / 2)`,
                    transform: "translateX(-50%)",
                    padding: "12px 20px",
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid ${c2}`,
                    borderRadius: 16,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    gap: 15,
                    zIndex: 4
                }}
            >
                <div>
                    <div style={{ fontWeight: "bold" }}>
                        {selectedContact ? selectedContact.displayName : selectedUser}
                    </div>
                    <div style={{ fontSize: 11, color: c2 }}>
                        {selectedContact
                            ? (selectedContact.status === "online" ? "online" : "offline")
                            : `energy: ${energy}`
                        }
                    </div>
                </div>
                <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    style={{
                        background: "none",
                        border: "none",
                        color: showRightPanel ? c1 : "white",
                        cursor: "pointer",
                        fontSize: "12px",
                        padding: "4px 8px",
                        fontFamily: "monospace",
                        borderLeft: "1px solid rgba(255,255,255,0.2)"
                    }}
                >
                    INFO
                </button>
            </div>








            {/* 💬 CHAT (FIXED DIM + HOVER SYSTEM) */}
            <div
                style={{
                    position: "absolute",
                    left: 280,
                    right: showRightPanel ? 320 : 20,
                    top: 80,
                    bottom: 90,
                    overflowY: "auto",
                    padding: 20,
                    transition: "all 0.3s ease"
                }}
            >
                <div
    style={{
        marginBottom: 12,
        position: "sticky",
        top: 0,
        zIndex: 10
    }}
>
    <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search messages..."
        style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${c1}`,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: "12px",
            fontFamily: "monospace",
            outline: "none"
        }}
    />
</div>
                {messages
    .filter((m) =>
        m.text?.toLowerCase().includes(search.toLowerCase())
    )
    .map((m, i) => {
                    const isMe = m.senderId === user?.uid;
                    return (
                        <div
                            key={m.id}
                            onMouseEnter={() => setHoveredMessage(m.id)}
                            onMouseLeave={() => setHoveredMessage(null)}
                            style={{
                                marginBottom: 12,
                                textAlign: isMe ? "right" : "left",
                                opacity:
                                    hoveredMessage === m.id
                                        ? 1
                                        : getMessageOpacity(i),
                                transition: "opacity 0.25s ease",
                            }}
                        >
                            {!isMe && (
                                <div style={{
                                    fontSize: "10px",
                                    opacity: 0.5,
                                    marginBottom: "4px",
                                    fontFamily: "monospace",
                                    marginLeft: "8px"
                                }}>
                                    {m.senderName}
                                </div>
                            )}








                <div
    style={{
        display: "inline-block",
        padding: "10px 14px",
        border: isMe ? `1px solid ${c1}` : "1px solid rgba(255,255,255,0.2)",
        borderRadius: 14,
        background: isMe ? "rgba(10,10,10,0.6)" : "rgba(30,30,30,0.4)",
        maxWidth: "60%",
        cursor: "pointer",
        textAlign: "left"
    }}
>
    {m.type === "image" ? (
        <img
            src={m.image}
            alt="uploaded"
            style={{
                maxWidth: "250px",
                maxHeight: "250px",
                borderRadius: "12px",
                display: "block",
            }}
        />
    ) : (
        m.text
    )}




    <div
        style={{
            fontSize: "8px",
            opacity: 0.4,
            marginTop: "4px",
            textAlign: "right",
            fontFamily: "monospace",
            letterSpacing: "0.5px"
        }}
    >
        {new Date(m.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })}
    </div>


{isMe && (
    <button
        onClick={() => setDeleteTarget(m.id)}
        style={{
            marginTop: 6,
            fontSize: "9px",
            background: "transparent",
            border: "none",
            color: "#ff4d4d",
            cursor: "pointer",
            fontFamily: "monospace",
            display: "block"
        }}
    >
        delete
    </button>
)}


</div>
                        </div>
                    );
                })}


{isTyping && (
    <div
        style={{
            marginTop: 10,
            fontSize: "11px",
            opacity: 0.6,
            fontFamily: "monospace",
            color: c2,
        }}
    >
        {typingName} is typing...
    </div>
)}




                {/* 🌌 UPLOADING NOTICE */}
                {uploading && (
                    <div style={{ textAlign: "right", margin: "10px 0" }}>
                        <div style={{
                            display: "inline-block",
                            padding: "8px 12px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${c1}`,
                            borderRadius: "10px",
                            color: c2,
                            fontSize: "11px",
                            fontFamily: "monospace",
                            animation: "pulse 1.5s infinite"
                        }}>
                            ● TRANSLATING IMAGE TO NEBULA SPECTRUM...
                        </div>
                    </div>
                )}
            </div>


{deleteTarget && (
    <div
        style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
        }}
        onClick={() => setDeleteTarget(null)}
    >
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                width: 260,
                padding: 20,
                borderRadius: 16,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 0 30px rgba(255,77,141,0.25)",
                textAlign: "center",
                fontFamily: "monospace",
                color: "white",
                animation: "pop 0.2s ease"
            }}
        >
            <div style={{ fontSize: 14, marginBottom: 10 }}>
                delete this message?
            </div>


            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 16 }}>
                this action cannot be undone
            </div>


            <div style={{ display: "flex", gap: 10 }}>
                <button
                    onClick={() => setDeleteTarget(null)}
                    style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "transparent",
                        color: "white",
                        cursor: "pointer"
                    }}
                >
                    cancel
                </button>


                <button
                    onClick={async () => {
                        await deleteMessage(deleteTarget);
                        setDeleteTarget(null);
                    }}
                    style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #ff4d4d, #ff7ad9)",
                        color: "white",
                        cursor: "pointer",
                        boxShadow: "0 0 15px rgba(255,77,141,0.4)"
                    }}
                >
                    delete
                </button>
            </div>
        </div>
    </div>
)}




            {/* ⌨️ INPUT */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: `calc(280px + (100% - 280px - ${showRightPanel ? "320px" : "20px"}) / 2)`,
                    transform: "translateX(-50%)",
                    width: "55%",
                    display: "flex",
                    gap: 10,
                    transition: "all 0.3s ease"
                }}
            >
                <input
                    type="file"
                    accept="image/*"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                />
                <input
    value={input}
    onChange={(e) => {
        setInput(e.target.value);


        setIsTyping(true);


        clearTimeout(typingTimeoutRef.current);


        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
        }, 1200);
    }}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 12,
                        border: `1px solid ${c1}`,
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                    }}
                />
                <button
                    onClick={() => imageInputRef.current?.click()}
                    style={{
                        padding: "14px 18px",
                        borderRadius: 12,
                        border: `1px solid ${c1}`,
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        cursor: "pointer",
                    }}
                >
                    📷
                </button>
                <button
                    onClick={sendMessage}
                    style={{
                        padding: "14px 18px",
                        borderRadius: 12,
                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    send
                </button>
            </div>








            {/* ℹ️ RIGHT PANEL (CONTACT / CHANNEL DETAILS) */}
            <div
                style={{
                    position: "absolute",
                    right: 20,
                    top: 20,
                    bottom: 20,
                    width: 280,
                    background: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${c1}`,
                    borderRadius: 16,
                    padding: 20,
                    display: showRightPanel ? "flex" : "none",
                    flexDirection: "column",
                    alignItems: "center",
                    zIndex: 5,
                    fontFamily: "monospace",
                    boxSizing: "border-box"
                }}
            >
                <div style={{ alignSelf: "flex-end" }}>
                    <button
                        onClick={() => setShowRightPanel(false)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "14px"
                        }}
                    >
                        ✕
                    </button>
                </div>


                {selectedContact ? (
                    <>
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.05)",
                            border: `2px solid ${c1}`,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: "36px",
                            fontWeight: "bold",
                            marginTop: 20,
                            color: c2
                        }}>
                            {selectedContact.displayName ? selectedContact.displayName[0].toUpperCase() : "👤"}
                        </div>
                       
                        <h3 style={{ margin: "16px 0 4px 0", color: "white", fontSize: "18px" }}>
                            {selectedContact.displayName}
                        </h3>
                       
                        <div style={{
                            fontSize: "11px",
                            color: selectedContact.status === "online" ? "#4de1ff" : "#888",
                            marginBottom: 20
                        }}>
                            ● {selectedContact.status === "online" ? "ONLINE" : "OFFLINE"}
                        </div>








                        <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 15, fontSize: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                                <span style={{ opacity: 0.5 }}>EMAIL:</span>
                                <div style={{ color: "white", wordBreak: "break-all", marginTop: 2 }}>{selectedContact.email}</div>
                            </div>
                            <div>
                                <span style={{ opacity: 0.5 }}>UID:</span>
                                <div style={{ color: "white", fontSize: "10px", wordBreak: "break-all", marginTop: 2 }}>{selectedContact.contactUid || selectedContact.uid}</div>
                            </div>
                            <div>
                                <span style={{ opacity: 0.5 }}>LAST LOG:</span>
                                <div style={{ color: "white", marginTop: 2 }}>
                                    {selectedContact.lastActive ? new Date(selectedContact.lastActive).toLocaleTimeString() : "Never"}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.05)",
                            border: `2px solid ${c1}`,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: "36px",
                            fontWeight: "bold",
                            marginTop: 20,
                            color: c2
                        }}>
                            🌌
                        </div>
                       
                        <h3 style={{ margin: "16px 0 4px 0", color: "white", fontSize: "18px" }}>
                            {selectedUser}
                        </h3>
                       
                        <div style={{
                            fontSize: "11px",
                            color: c2,
                            marginBottom: 20
                        }}>
                            PUBLIC NODE
                        </div>








                        <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 15, fontSize: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                                <span style={{ opacity: 0.5 }}>NODE ENERGY:</span>
                                <div style={{ color: "white", marginTop: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                                    <div style={{ background: `linear-gradient(90deg, ${c1}, ${c2})`, width: `${energy}%`, height: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <span style={{ opacity: 0.5 }}>STATUS:</span>
                                <div style={{ color: "white", marginTop: 2 }}>SYNCHRONIZED</div>
                            </div>
                            <div>
                                <span style={{ opacity: 0.5 }}>DESCRIPTION:</span>
                                <div style={{ color: "rgba(255,255,255,0.8)", marginTop: 2, fontSize: "11px", lineHeight: "1.4" }}>
                                    Public communications channel. Signals are routed in real-time.
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            {deleteTarget && (
    <div> ... your modal ... </div>
)}
            <style>{`
                @keyframes float {
                    0% { opacity: 0; transform: scale(0.5); }
                    20% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(-120px); }
                }
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}