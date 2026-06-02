import { useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase";
import { signOut, updateProfile } from "firebase/auth";
import { collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch, updateDoc } from "firebase/firestore";
import { uploadToCloudinary } from "../utils/cloudinary";
import UserSearch from "../components/UserSearch";
import ContactRequests from "../components/ContactRequests";
import ContactsList from "../components/ContactsList";


const CELESTIALS = ["⭐", "🌟", "✨", "🌙", "☀️", "🌌"];


const STATUS_OPTIONS = [
    { value: "online", label: "ONLINE", color: "#36e68a" },
    { value: "idle", label: "IDLE", color: "#ffd166" },
    { value: "dnd", label: "DO NOT DISTURB", color: "#ff4d5e" },
    { value: "offline", label: "OFFLINE", color: "#777" },
];

const statusColor = (status) => STATUS_OPTIONS.find((option) => option.value === status)?.color || "#777";

const getContactChatId = (uidA, uidB) => (uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`);

function getTimeframe() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 6) return "sunrise";
    if (hour >= 6 && hour < 10) return "morning";
    if (hour >= 10 && hour < 13) return "midday";
    if (hour >= 13 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 18) return "sunset";
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
    const [users] = useState(["atlas", "luna", "nova", "orion"]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [search, setSearch] = useState("");
    const [, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editTarget, setEditTarget] = useState(null);
    const [messageEditValue, setMessageEditValue] = useState("");
    const [replyTarget, setReplyTarget] = useState(null);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    // Tab and selection states
    const [sidebarTab, setSidebarTab] = useState("nodes"); // "nodes" or "contacts"
    const [selectedUser, setSelectedUser] = useState("atlas"); // node selection
    const [selectedContact, setSelectedContact] = useState(null); // contact selection
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [energy, setEnergy] = useState(30);
    const [uploadStatus, setUploadStatus] = useState("");
    const [profile, setProfile] = useState({
        displayName: user?.displayName || user?.email?.split("@")[0] || "Traveler",
        photoURL: user?.photoURL || "",
        status: "online",
    });
    const [profileForm, setProfileForm] = useState({
        displayName: user?.displayName || user?.email?.split("@")[0] || "Traveler",
        photoURL: user?.photoURL || "",
    });
    const [channelSettings, setChannelSettings] = useState({});
    const [channelForm, setChannelForm] = useState({ name: "", displayName: "" });
    const [contactForm, setContactForm] = useState({ nickname: "", displayName: "" });
    const [contactAction, setContactAction] = useState(null);
    // Modal state for full screen image
    const [enlargedImage, setEnlargedImage] = useState(null);
    // Typing indicator: name of the contact who is currently typing (null = nobody)
    const [peerTyping, setPeerTyping] = useState(null);
    // Read receipt: timestamp when the peer last opened the chat
    const [peerReadTs, setPeerReadTs] = useState(0);
    const pinnedMessages = messages
        .filter((message) => message.pinned)
        .sort((a, b) => (a.time || 0) - (b.time || 0));


    // Resolve the Firestore path based on active mode:
    // - Channels (nodes): personal per-user notepad → channels/{uid}_{channelName}/messages
    //   (3 path segments = valid Firestore collection depth)
    // - Contacts: shared two-user room → chats/{uid1_uid2}/messages
    const activeCollection = selectedContact
        ? `chats/${getContactChatId(user.uid, selectedContact.uid)}/messages`
        : selectedUser
            ? `channels/${user.uid}_${selectedUser}/messages`
            : null;

    // The chatId for a contact conversation (used for typing + read receipts)
    const contactChatId = selectedContact
        ? getContactChatId(user.uid, selectedContact.uid)
        : null;

    const selectedChannelSettings = selectedUser ? channelSettings[selectedUser] || {} : {};
    const selectedChannelName = selectedUser ? selectedChannelSettings.name || selectedUser : "";
    const channelDisplayName = selectedChannelSettings.displayName || profile.displayName || user?.displayName || user?.email?.split("@")[0] || "Anonymous";
    const mainDisplayName = profile.displayName || user?.displayName || user?.email?.split("@")[0] || "Anonymous";








    function renameUser(oldName) {
        setEditingUser(oldName);
        setEditValue(channelSettings[oldName]?.name || oldName);
    }








    async function saveRename(oldName) {
        const nextName = editValue.trim();
        if (!nextName || !user?.uid) {
            setEditingUser(null);
            return;
        }

        await setDoc(doc(db, "users", user.uid, "channels", oldName), {
            name: nextName,
            updatedAt: Date.now()
        }, { merge: true });
        setEditingUser(null);
    }








    const [celestials, setCelestials] = useState([]);
    const canvasRef = useRef(null);
    const imageInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const pinnedMessagesListRef = useRef(null);
    const historyRef = useRef([]);
    const moodRef = useRef("calm");
    const [hoveredMessage, setHoveredMessage] = useState(null);
    const [c1, c2] = getColors();

    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            const nextProfile = {
                displayName: data.displayName || user.displayName || user.email?.split("@")[0] || "Traveler",
                photoURL: data.photoURL || user.photoURL || "",
                status: data.status || "online",
            };
            setProfile(nextProfile);
            setProfileForm((prev) => ({
                displayName: prev.displayName || nextProfile.displayName,
                photoURL: prev.photoURL || nextProfile.photoURL,
            }));
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribe = onSnapshot(collection(db, "users", user.uid, "channels"), (snap) => {
            const nextSettings = {};
            snap.forEach((docSnap) => {
                nextSettings[docSnap.id] = docSnap.data();
            });
            setChannelSettings(nextSettings);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (selectedContact) {
            setContactForm({
                nickname: selectedContact.nickname || "",
                displayName: selectedContact.myDisplayName || "",
            });
        }
    }, [selectedContact]);

    useEffect(() => {
        if (!selectedContact?.uid) return;

        const unsubscribe = onSnapshot(doc(db, "users", selectedContact.uid), (docSnap) => {
            if (!docSnap.exists()) return;
            const profileData = docSnap.data();
            setSelectedContact((prev) => {
                if (!prev || prev.uid !== selectedContact.uid) return prev;
                const displayName = prev.nickname || profileData.displayName || prev.contactDisplayName || prev.displayName;
                return {
                    ...prev,
                    ...profileData,
                    uid: prev.uid,
                    contactDisplayName: prev.contactDisplayName,
                    nickname: prev.nickname,
                    myDisplayName: prev.myDisplayName,
                    displayName,
                    photoURL: profileData.photoURL || prev.photoURL || "",
                    status: profileData.status || "offline",
                };
            });
        });

        return () => unsubscribe();
    }, [selectedContact?.uid]);

    useEffect(() => {
        if (selectedUser) {
            const settings = channelSettings[selectedUser] || {};
            setChannelForm({
                name: settings.name || selectedUser,
                displayName: settings.displayName || "",
            });
        }
    }, [selectedUser, channelSettings]);

    useEffect(() => {
        setProfileForm({
            displayName: profile.displayName || user?.displayName || user?.email?.split("@")[0] || "Traveler",
            photoURL: profile.photoURL || user?.photoURL || "",
        });
    }, [profile.displayName, profile.photoURL, user]);








    /* ---------------- FIREBASE FIRESTORE SYNC ---------------- */
    useEffect(() => {
        // Always clear immediately so stale messages from previous chat never linger
        setMessages([]);

        if (!activeCollection) return;

        const parts = activeCollection.split("/");
        // Firestore collection() requires odd number of path segments
        if (parts.length % 2 === 0) {
            console.error("Invalid Firestore path (even segments):", activeCollection);
            return;
        }

        let unsubscribe = () => { };
        try {
            const q = query(
                collection(db, ...parts),
                orderBy("time", "asc")
            );
            unsubscribe = onSnapshot(q, (snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    list.push({ id: docSnap.id, ...docSnap.data() });
                });
                setMessages(list);
            }, (error) => {
                console.error("Firestore snapshot error:", error.code, error.message);
                setMessages([]); // clear on permission error so contact msgs don't bleed through
            });
        } catch (err) {
            console.error("Failed to create Firestore query:", err);
        }

        return () => {
            setMessages([]); // clear stale messages when switching away
            setReplyTarget(null);
            setEditTarget(null);
            setMessageEditValue("");
            unsubscribe();
        };
    }, [activeCollection]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length, activeCollection]);

    useEffect(() => {
        if (!showPinnedMessages) return;
        const pinnedList = pinnedMessagesListRef.current;
        if (pinnedList) {
            pinnedList.scrollTop = pinnedList.scrollHeight;
        }
    }, [showPinnedMessages, pinnedMessages.length]);


    /* ---------------- TYPING INDICATOR (contacts only) ---------------- */
    useEffect(() => {
        if (!contactChatId || !selectedContact) {
            setPeerTyping(null);
            return;
        }

        const typingDocRef = doc(db, "typing", contactChatId);
        const unsub = onSnapshot(typingDocRef, (snap) => {
            if (!snap.exists()) { setPeerTyping(null); return; }
            const data = snap.data();
            const peerUid = selectedContact.uid;
            const peerTs = data[peerUid];
            // Show typing if peer's timestamp is within the last 5 seconds
            if (peerTs && Date.now() - peerTs < 5000) {
                setPeerTyping(selectedContact.displayName || selectedContact.email?.split("@")[0] || "Contact");
            } else {
                setPeerTyping(null);
            }
        }, () => setPeerTyping(null));

        return () => unsub();
    }, [contactChatId, selectedContact]);


    /* ---------------- READ RECEIPTS (contacts only) ---------------- */
    // Write OUR read timestamp when we open (or receive new messages in) a contact chat
    useEffect(() => {
        if (!contactChatId || !user?.uid) return;
        const readDocRef = doc(db, "readReceipts", contactChatId);
        setDoc(readDocRef, { [user.uid]: Date.now() }, { merge: true }).catch(() => { });
    }, [contactChatId, messages.length, user?.uid]);

    // Listen to the peer's read timestamp and show it on our last message
    useEffect(() => {
        if (!contactChatId || !selectedContact) {
            setPeerReadTs(0);
            return;
        }

        const readDocRef = doc(db, "readReceipts", contactChatId);
        const unsub = onSnapshot(readDocRef, (snap) => {
            if (!snap.exists()) { setPeerReadTs(0); return; }
            const peerTs = snap.data()[selectedContact.uid];
            if (!peerTs) { setPeerReadTs(0); return; }
            setPeerReadTs(peerTs);
        }, () => setPeerReadTs(0));

        return () => { unsub(); setPeerReadTs(0); };
    }, [contactChatId, selectedContact]);








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
    function getReplyPreview(message) {
        if (!message) return "";
        if (message.type === "image") return "[image]";
        return message.text || "";
    }

    function getMessageDisplayName(message) {
        if (message.senderId === user?.uid) {
            return message.senderName || (selectedContact ? selectedContact.myDisplayName || mainDisplayName : channelDisplayName);
        }
        return message.senderName || selectedContact?.displayName || message.senderEmail?.split("@")[0] || "Unknown";
    }

    function getMessagePhotoURL(message) {
        if (message.senderId === user?.uid) {
            return profile.photoURL || user?.photoURL || "";
        }
        return selectedContact?.photoURL || "";
    }

    function getMessageInitial(message) {
        const name = getMessageDisplayName(message);
        return name ? name[0].toUpperCase() : "?";
    }

    function startReply(message) {
        setReplyTarget({
            id: message.id,
            text: getReplyPreview(message),
            type: message.type || "text",
            senderName: message.senderName || "Unknown",
            senderId: message.senderId || "",
            image: message.image || "",
        });
    }

    function startEditMessage(message) {
        if (message.type === "image") return;
        setEditTarget(message.id);
        setMessageEditValue(message.text || "");
    }

    function cancelEditMessage() {
        setEditTarget(null);
        setMessageEditValue("");
    }

    async function saveEditedMessage(messageId) {
        if (!activeCollection || !messageEditValue.trim()) return;

        try {
            await updateDoc(doc(db, ...activeCollection.split("/"), messageId), {
                text: messageEditValue.trim(),
                editedAt: Date.now(),
            });
            cancelEditMessage();
        } catch (err) {
            console.error("edit failed:", err);
        }
    }

    async function togglePinMessage(message) {
        if (!activeCollection) return;

        try {
            await setDoc(doc(db, ...activeCollection.split("/"), message.id), {
                pinned: !message.pinned,
                pinnedAt: !message.pinned ? Date.now() : null,
                pinnedBy: !message.pinned ? user?.uid || "" : null,
            }, { merge: true });
        } catch (err) {
            console.error("pin failed:", err);
        }
    }

    async function sendMessage() {
        if (!input.trim() || !activeCollection) return;
        if (CELESTIALS.includes(input.trim())) {
            spawnStar(input.trim());
            setInput("");
            return;
        }

        const textToSend = input.trim();
        setInput("");

        try {
            await addDoc(collection(db, ...activeCollection.split("/")), {
                text: textToSend,
                type: "text",
                time: Date.now(),
                senderId: user?.uid || "anonymous",
                senderEmail: user?.email || "",
                senderName: selectedContact
                    ? selectedContact.myDisplayName || mainDisplayName
                    : channelDisplayName,
                replyTo: replyTarget || null,
            });
            setReplyTarget(null);
            setEnergy((e) => Math.min(e + 5, 100));
        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(textToSend);
        }
    }


    async function deleteMessage(messageId) {
        if (!activeCollection) return;
        try {
            await deleteDoc(doc(db, ...activeCollection.split("/"), messageId));
        } catch (err) {
            console.error("delete failed:", err);
        }
    }

    async function saveProfile() {
        if (!user?.uid) return;
        const displayName = profileForm.displayName.trim() || user.email?.split("@")[0] || "Traveler";
        const photoURL = profileForm.photoURL.trim();

        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName, photoURL });
            }

            await setDoc(doc(db, "users", user.uid), {
                displayName,
                searchName: displayName.toLowerCase(),
                photoURL,
                lastActive: Date.now()
            }, { merge: true });
        } catch (err) {
            console.error("Failed to save profile:", err);
        }
    }

    async function updateUserStatus(nextStatus) {
        if (!user?.uid) return;
        try {
            await setDoc(doc(db, "users", user.uid), {
                status: nextStatus,
                lastActive: Date.now()
            }, { merge: true });
        } catch (err) {
            console.error("Failed to update status:", err);
        }
    }

    async function saveContactNames() {
        if (!user?.uid || !selectedContact?.uid) return;

        const nickname = contactForm.nickname.trim();
        const myDisplayName = contactForm.displayName.trim();

        try {
            await setDoc(doc(db, "users", user.uid, "contacts", selectedContact.uid), {
                nickname,
                myDisplayName,
                updatedAt: Date.now()
            }, { merge: true });
            setSelectedContact((prev) => prev ? {
                ...prev,
                nickname,
                myDisplayName,
                displayName: nickname || prev.contactDisplayName || prev.displayName,
            } : prev);
        } catch (err) {
            console.error("Failed to save contact names:", err);
        }
    }

    async function archiveSelectedContact() {
        if (!user?.uid || !selectedContact?.uid) return;

        try {
            await setDoc(doc(db, "users", user.uid, "contacts", selectedContact.uid), {
                archived: true,
                archivedAt: Date.now()
            }, { merge: true });
            setSelectedContact(null);
            setMessages([]);
            setShowRightPanel(false);
        } catch (err) {
            console.error("Failed to archive contact:", err);
        }
    }

    async function deleteSelectedContactForever() {
        if (!user?.uid || !selectedContact?.uid) return;

        const peerUid = selectedContact.uid;
        const chatId = getContactChatId(user.uid, peerUid);
        const requestId = getContactChatId(user.uid, peerUid);

        try {
            const messagesSnap = await getDocs(collection(db, "chats", chatId, "messages"));
            const messageDocs = messagesSnap.docs;

            for (let i = 0; i < messageDocs.length; i += 450) {
                const batch = writeBatch(db);
                messageDocs.slice(i, i + 450).forEach((messageDoc) => {
                    batch.delete(messageDoc.ref);
                });
                await batch.commit();
            }

            const cleanupBatch = writeBatch(db);
            cleanupBatch.delete(doc(db, "users", user.uid, "contacts", peerUid));
            cleanupBatch.delete(doc(db, "users", peerUid, "contacts", user.uid));
            cleanupBatch.delete(doc(db, "contactRequests", requestId));
            cleanupBatch.delete(doc(db, "typing", chatId));
            cleanupBatch.delete(doc(db, "readReceipts", chatId));
            await cleanupBatch.commit();

            setSelectedContact(null);
            setMessages([]);
            setShowRightPanel(false);
            setContactAction(null);
        } catch (err) {
            console.error("Failed to delete contact forever:", err);
        }
    }

    async function saveChannelSettings() {
        if (!user?.uid || !selectedUser) return;

        const name = channelForm.name.trim() || selectedUser;
        const displayName = channelForm.displayName.trim();

        try {
            await setDoc(doc(db, "users", user.uid, "channels", selectedUser), {
                name,
                displayName,
                updatedAt: Date.now()
            }, { merge: true });
        } catch (err) {
            console.error("Failed to save channel settings:", err);
        }
    }




    async function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            setUploadStatus("ERROR: No file selected");
            setTimeout(() => setUploadStatus(""), 5000);
            return;
        }
        if (!activeCollection) {
            setUploadStatus("ERROR: No active channel/contact selected");
            setTimeout(() => setUploadStatus(""), 5000);
            return;
        }

        setUploadStatus(`[1/3] Uploading to Cloudinary (file: ${file.name}, size: ${Math.round(file.size / 1024)}KB)...`);
        let imageUrl = "";
        try {
            const uploadPromise = uploadToCloudinary(file);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Cloudinary upload timed out after 30 seconds")), 30000));
            imageUrl = await Promise.race([uploadPromise, timeoutPromise]);

            if (!imageUrl) throw new Error("Cloudinary returned empty URL");
            setUploadStatus(`[2/3] Got image URL. Saving to Firestore (path: ${activeCollection})...`);
        } catch (cloudErr) {
            setUploadStatus("ERROR in step 1 (Cloudinary): " + cloudErr.message);
            setTimeout(() => setUploadStatus(""), 10000);
            if (event.target) event.target.value = "";
            return;
        }

        try {
            const docData = {
                image: imageUrl,
                type: "image",
                time: Date.now(),
                senderId: user?.uid || "anonymous",
                senderEmail: user?.email || "",
                senderName: selectedContact
                    ? selectedContact.myDisplayName || mainDisplayName
                    : channelDisplayName,
                replyTo: replyTarget || null,
            };
            const addPromise = addDoc(collection(db, ...activeCollection.split("/")), docData);
            const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timed out after 15 seconds")), 15000));
            const docRef = await Promise.race([addPromise, dbTimeout]);

            setReplyTarget(null);
            setEnergy((e) => Math.min(e + 5, 100));
            setUploadStatus(`[3/3] SUCCESS! Saved as doc: ${docRef.id}`);
            setTimeout(() => setUploadStatus(""), 4000);
        } catch (dbErr) {
            setUploadStatus("ERROR in step 2 (Firestore): " + dbErr.message + " | code: " + dbErr.code);
            setTimeout(() => setUploadStatus(""), 10000);
        } finally {
            if (event.target) event.target.value = "";
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
                        onClick={() => {
                            setMessages([]);              // clear immediately
                            setSelectedContact(null);     // stop contact subscription
                            setSidebarTab("nodes");
                            if (!selectedUser) setSelectedUser(users[0]);
                        }}
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
                        onClick={() => {
                            setMessages([]);              // clear immediately
                            setSelectedUser(null);        // stop channel subscription
                            setSidebarTab("contacts");
                            setSelectedContact(null);     // deselect any contact too
                        }}
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
                                            onChange={(e) => setEditValue(e.target.value)}

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
                                            {channelSettings[u]?.name || u}
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginBottom: 8 }}>
                        <input
                            value={profileForm.displayName}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                            placeholder="display name"
                            style={{
                                padding: "7px 8px",
                                borderRadius: 7,
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(0,0,0,0.45)",
                                color: "white",
                                fontSize: 10,
                                fontFamily: "monospace"
                            }}
                        />
                        <input
                            value={profileForm.photoURL}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, photoURL: e.target.value }))}
                            placeholder="profile photo url"
                            style={{
                                padding: "7px 8px",
                                borderRadius: 7,
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(0,0,0,0.45)",
                                color: "white",
                                fontSize: 10,
                                fontFamily: "monospace"
                            }}
                        />
                        <select
                            value={profile.status}
                            onChange={(e) => updateUserStatus(e.target.value)}
                            style={{
                                padding: "7px 8px",
                                borderRadius: 7,
                                border: `1px solid ${statusColor(profile.status)}`,
                                background: "rgba(0,0,0,0.75)",
                                color: "white",
                                fontSize: 10,
                                fontFamily: "monospace"
                            }}
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={saveProfile}
                            style={{
                                width: "100%",
                                padding: "7px 10px",
                                borderRadius: 8,
                                background: "rgba(255,255,255,0.08)",
                                border: `1px solid ${c1}`,
                                color: "white",
                                fontSize: 10,
                                cursor: "pointer",
                                fontFamily: "monospace"
                            }}
                        >
                            SAVE PROFILE
                        </button>
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
                        {selectedContact ? selectedContact.displayName : selectedChannelName}
                    </div>
                    <div style={{ fontSize: 11, color: selectedContact ? statusColor(selectedContact.status) : c2 }}>
                        {selectedContact
                            ? selectedContact.status || "offline"
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
                {false && messages.some((message) => message.pinned) && (
                    <div style={{
                        marginBottom: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}>
                        {messages
                            .filter((message) => message.pinned)
                            .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0))
                            .slice(0, 3)
                            .map((message) => (
                                <div
                                    key={`pinned-${message.id}`}
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        border: `1px solid ${c1}`,
                                        background: "rgba(255,255,255,0.06)",
                                        fontFamily: "monospace",
                                        fontSize: 11,
                                        color: "white",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 10
                                    }}
                                >
                                    <span style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        PINNED · {message.senderName}: {getReplyPreview(message)}
                                    </span>
                                    <button
                                        onClick={() => togglePinMessage(message)}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: c2,
                                            cursor: "pointer",
                                            fontSize: 10,
                                            fontFamily: "monospace"
                                        }}
                                    >
                                        unpin
                                    </button>
                                </div>
                            ))}
                    </div>
                )}
                <div
                    style={{
                        marginBottom: 12,
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 0.6fr) minmax(260px, 1.4fr)",
                        gap: 10,
                        alignItems: "start"
                    }}
                >
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setShowPinnedMessages((open) => !open)}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: `1px solid ${c1}`,
                                background: "rgba(0,0,0,0.75)",
                                color: "white",
                                fontSize: "12px",
                                fontFamily: "monospace",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10
                            }}
                        >
                            <span>PINNED MESSAGES ({pinnedMessages.length})</span>
                            <span style={{ color: c2 }}>{showPinnedMessages ? "^" : "v"}</span>
                        </button>

                        {showPinnedMessages && (
                            <div ref={pinnedMessagesListRef} style={{
                                position: "absolute",
                                top: "calc(100% + 8px)",
                                left: 0,
                                right: 0,
                                maxHeight: 220,
                                overflowY: "auto",
                                padding: 8,
                                borderRadius: 10,
                                border: `1px solid ${c1}`,
                                background: "rgba(0,0,0,0.92)",
                                boxShadow: `0 0 22px ${c1}30`,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8
                            }}>
                                {pinnedMessages.length === 0 ? (
                                    <div style={{
                                        padding: "12px 10px",
                                        fontFamily: "monospace",
                                        fontSize: 11,
                                        color: "rgba(255,255,255,0.55)",
                                        textAlign: "center"
                                    }}>
                                        NO PINNED MESSAGES
                                    </div>
                                ) : (
                                    pinnedMessages.map((message) => (
                                            <div
                                                key={`pinned-${message.id}`}
                                                style={{
                                                    padding: "8px 10px",
                                                    borderRadius: 8,
                                                    border: "1px solid rgba(255,255,255,0.12)",
                                                    background: "rgba(255,255,255,0.05)",
                                                    color: "white",
                                                    fontFamily: "monospace",
                                                    fontSize: 11,
                                                    display: "grid",
                                                    gap: 4
                                                }}
                                            >
                                                <div style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 8,
                                                    opacity: 0.65,
                                                    fontSize: 9
                                                }}>
                                                    <span>{message.senderName}</span>
                                                    <span>{new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                                <div style={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}>
                                                    {getReplyPreview(message)}
                                                </div>
                                                <button
                                                    onClick={() => togglePinMessage(message)}
                                                    style={{
                                                        justifySelf: "end",
                                                        border: "none",
                                                        background: "transparent",
                                                        color: c2,
                                                        cursor: "pointer",
                                                        fontSize: 10,
                                                        fontFamily: "monospace",
                                                        padding: 0
                                                    }}
                                                >
                                                    unpin
                                                </button>
                                            </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

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
                {(() => {
                    const filteredMessages = messages.filter((m) =>
                        m.type === "image" || m.text?.toLowerCase().includes(search.toLowerCase())
                    );
                    // Index of last message sent by me (for read receipt)
                    let lastMeIdx = -1;
                    filteredMessages.forEach((m, idx) => { if (m.senderId === user?.uid) lastMeIdx = idx; });
                    return filteredMessages.map((m, i) => {
                        const isMe = m.senderId === user?.uid;
                        const nextMessage = filteredMessages[i + 1];
                        const showMessageIdentity = !nextMessage || nextMessage.senderId !== m.senderId;
                        const messagePhotoURL = getMessagePhotoURL(m);
                        const messageDisplayName = getMessageDisplayName(m);
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
                                {showMessageIdentity && (
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: isMe ? "flex-end" : "flex-start",
                                        gap: 8,
                                        marginBottom: 6,
                                        fontFamily: "monospace",
                                        fontSize: 11,
                                        color: "rgba(255,255,255,0.72)"
                                    }}>
                                        {!isMe && (
                                            <div style={{
                                                width: 26,
                                                height: 26,
                                                borderRadius: "50%",
                                                border: `1px solid ${c1}`,
                                                background: "rgba(255,255,255,0.08)",
                                                overflow: "hidden",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: c2,
                                                fontWeight: "bold",
                                                flex: "0 0 auto"
                                            }}>
                                                {messagePhotoURL ? (
                                                    <img src={messagePhotoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                ) : (
                                                    getMessageInitial(m)
                                                )}
                                            </div>
                                        )}
                                        <span>{messageDisplayName}</span>
                                        {isMe && (
                                            <div style={{
                                                width: 26,
                                                height: 26,
                                                borderRadius: "50%",
                                                border: `1px solid ${c1}`,
                                                background: "rgba(255,255,255,0.08)",
                                                overflow: "hidden",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: c2,
                                                fontWeight: "bold",
                                                flex: "0 0 auto"
                                            }}>
                                                {messagePhotoURL ? (
                                                    <img src={messagePhotoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                ) : (
                                                    getMessageInitial(m)
                                                )}
                                            </div>
                                        )}
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
                                    {m.replyTo && (
                                        <div style={{
                                            padding: "6px 8px",
                                            marginBottom: 8,
                                            borderLeft: `2px solid ${c2}`,
                                            background: "rgba(255,255,255,0.05)",
                                            borderRadius: 6,
                                            fontFamily: "monospace",
                                            fontSize: 10,
                                            opacity: 0.85,
                                            maxWidth: "100%",
                                            overflow: "hidden"
                                        }}>
                                            <div style={{ color: c2, marginBottom: 2 }}>
                                                replying to {m.replyTo.senderName || "Unknown"}
                                            </div>
                                            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {m.replyTo.text || (m.replyTo.type === "image" ? "[image]" : "")}
                                            </div>
                                        </div>
                                    )}

                                    {editTarget === m.id ? (
                                        <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
                                            <input
                                                value={messageEditValue}
                                                onChange={(e) => setMessageEditValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") saveEditedMessage(m.id);
                                                    if (e.key === "Escape") cancelEditMessage();
                                                }}
                                                autoFocus
                                                style={{
                                                    padding: "8px 10px",
                                                    borderRadius: 8,
                                                    border: `1px solid ${c1}`,
                                                    background: "rgba(0,0,0,0.5)",
                                                    color: "white",
                                                    fontFamily: "monospace"
                                                }}
                                            />
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button
                                                    onClick={() => saveEditedMessage(m.id)}
                                                    style={{
                                                        flex: 1,
                                                        border: "none",
                                                        borderRadius: 6,
                                                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                                        color: "white",
                                                        cursor: "pointer",
                                                        fontSize: 10,
                                                        fontFamily: "monospace",
                                                        padding: 6
                                                    }}
                                                >
                                                    save
                                                </button>
                                                <button
                                                    onClick={cancelEditMessage}
                                                    style={{
                                                        flex: 1,
                                                        border: "1px solid rgba(255,255,255,0.2)",
                                                        borderRadius: 6,
                                                        background: "transparent",
                                                        color: "white",
                                                        cursor: "pointer",
                                                        fontSize: 10,
                                                        fontFamily: "monospace",
                                                        padding: 6
                                                    }}
                                                >
                                                    cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : m.type === "image" ? (
                                        <img
                                            src={m.image}
                                            alt="uploaded"
                                            onClick={() => setEnlargedImage(m.image)}
                                            style={{
                                                maxWidth: "250px",
                                                maxHeight: "250px",
                                                borderRadius: "12px",
                                                display: "block",
                                            }}
                                        />
                                    ) : (
                                        <>
                                            {m.text}
                                            {m.editedAt && (
                                                <span style={{ fontSize: 9, opacity: 0.45, marginLeft: 6 }}>
                                                    edited
                                                </span>
                                            )}
                                        </>
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


                                    <div style={{
                                        marginTop: 6,
                                        display: "flex",
                                        gap: 8,
                                        justifyContent: isMe ? "flex-end" : "flex-start",
                                        flexWrap: "wrap"
                                    }}>
                                        <button
                                            onClick={() => startReply(m)}
                                            style={{
                                                fontSize: "9px",
                                                background: "transparent",
                                                border: "none",
                                                color: c2,
                                                cursor: "pointer",
                                                fontFamily: "monospace"
                                            }}
                                        >
                                            reply
                                        </button>
                                        <button
                                            onClick={() => togglePinMessage(m)}
                                            style={{
                                                fontSize: "9px",
                                                background: "transparent",
                                                border: "none",
                                                color: m.pinned ? c1 : "rgba(255,255,255,0.65)",
                                                cursor: "pointer",
                                                fontFamily: "monospace"
                                            }}
                                        >
                                            {m.pinned ? "unpin" : "pin"}
                                        </button>
                                        {isMe && m.type !== "image" && (
                                            <button
                                                onClick={() => startEditMessage(m)}
                                                style={{
                                                    fontSize: "9px",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "rgba(255,255,255,0.75)",
                                                    cursor: "pointer",
                                                    fontFamily: "monospace"
                                                }}
                                            >
                                                edit
                                            </button>
                                        )}
                                        {isMe && (
                                            <button
                                                onClick={() => setDeleteTarget(m.id)}
                                                style={{
                                                    fontSize: "9px",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#ff4d4d",
                                                    cursor: "pointer",
                                                    fontFamily: "monospace"
                                                }}
                                            >
                                                delete
                                            </button>
                                        )}
                                    </div>


                                    {/* Read receipt: only on last message sent by me, in contacts chats */}
                                    {isMe && i === lastMeIdx && selectedContact && peerReadTs >= m.time && (
                                        <div style={{
                                            fontSize: "9px",
                                            opacity: 0.5,
                                            marginTop: "3px",
                                            textAlign: "right",
                                            fontFamily: "monospace",
                                            color: c1,
                                        }}>
                                            ✓ Seen at {new Date(peerReadTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    });
                })()}


                {peerTyping && (
                    <div
                        style={{
                            marginTop: 10,
                            fontSize: "11px",
                            opacity: 0.7,
                            fontFamily: "monospace",
                            color: c2,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <span style={{ display: "inline-flex", gap: 3 }}>
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    width: 5, height: 5,
                                    borderRadius: "50%",
                                    background: c2,
                                    display: "inline-block",
                                    animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite`
                                }} />
                            ))}
                        </span>
                        {peerTyping} is typing...
                    </div>
                )}




                {/* 🌌 UPLOADING NOTICE */}
                {uploadStatus && (
                    <div style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        border: `1px solid ${c1}`,
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.4)",
                        display: "inline-block",
                        alignSelf: "flex-end",
                        color: c1,
                        fontSize: "10px",
                        fontFamily: "monospace",
                        boxShadow: `0 0 10px ${c1}40`
                    }}>
                        ● {uploadStatus}
                    </div>
                )}
                <div ref={messagesEndRef} />
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

            {replyTarget && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 78,
                        left: `calc(280px + (100% - 280px - ${showRightPanel ? "320px" : "20px"}) / 2)`,
                        transform: "translateX(-50%)",
                        width: "55%",
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: `1px solid ${c1}`,
                        background: "rgba(0,0,0,0.75)",
                        color: "white",
                        fontFamily: "monospace",
                        fontSize: 11,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 8
                    }}
                >
                    <div style={{ overflow: "hidden" }}>
                        <div style={{ color: c2, marginBottom: 2 }}>
                            replying to {replyTarget.senderName}
                        </div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {replyTarget.text || (replyTarget.type === "image" ? "[image]" : "")}
                        </div>
                    </div>
                    <button
                        onClick={() => setReplyTarget(null)}
                        style={{
                            border: "none",
                            background: "transparent",
                            color: "white",
                            cursor: "pointer",
                            fontFamily: "monospace",
                            fontSize: 12
                        }}
                    >
                        cancel
                    </button>
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

                        // Write typing status to Firestore (contacts only)
                        if (contactChatId) {
                            const typingDocRef = doc(db, "typing", contactChatId);
                            setDoc(typingDocRef, { [user.uid]: Date.now() }, { merge: true }).catch(() => { });
                        }

                        clearTimeout(typingTimeoutRef.current);

                        typingTimeoutRef.current = setTimeout(() => {
                            setIsTyping(false);
                            // Clear typing status after 4s of inactivity
                            if (contactChatId) {
                                const typingDocRef = doc(db, "typing", contactChatId);
                                setDoc(typingDocRef, { [user.uid]: 0 }, { merge: true }).catch(() => { });
                            }
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
                    disabled={!!uploadStatus}
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
                    disabled={!!uploadStatus}
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
                            color: selectedContact.photoURL ? "transparent" : c2,
                            overflow: "hidden",
                            position: "relative"
                        }}>
                            {selectedContact.photoURL && (
                                <img
                                    src={selectedContact.photoURL}
                                    alt=""
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        position: "absolute"
                                    }}
                                />
                            )}
                            {selectedContact.displayName ? selectedContact.displayName[0].toUpperCase() : "👤"}
                        </div>

                        <h3 style={{ margin: "16px 0 4px 0", color: "white", fontSize: "18px" }}>
                            {selectedContact.displayName}
                        </h3>

                        <div style={{
                            fontSize: "11px",
                            color: statusColor(selectedContact.status),
                            marginBottom: 20
                        }}>
                            ● {selectedContact.status === "online" ? "ONLINE" : "OFFLINE"}
                        </div>








                        <div style={{ width: "100%", display: "grid", gap: 8, marginBottom: 14 }}>
                            <input
                                value={contactForm.nickname}
                                onChange={(e) => setContactForm((prev) => ({ ...prev, nickname: e.target.value }))}
                                placeholder="nickname for this contact"
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(0,0,0,0.45)",
                                    color: "white",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            />
                            <input
                                value={contactForm.displayName}
                                onChange={(e) => setContactForm((prev) => ({ ...prev, displayName: e.target.value }))}
                                placeholder="my name in this chat"
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(0,0,0,0.45)",
                                    color: "white",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            />
                            <button
                                onClick={saveContactNames}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: `1px solid ${c1}`,
                                    background: "rgba(255,255,255,0.08)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            >
                                SAVE CONTACT NAMES
                            </button>
                            <button
                                onClick={archiveSelectedContact}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "rgba(255,255,255,0.04)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            >
                                ARCHIVE CONTACT
                            </button>
                            <button
                                onClick={() => setContactAction("deleteForever")}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #ff4d5e",
                                    background: "rgba(255,77,94,0.12)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            >
                                DELETE CONTACT + MESSAGES
                            </button>
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
                            {selectedChannelName}
                        </h3>

                        <div style={{
                            fontSize: "11px",
                            color: c2,
                            marginBottom: 20
                        }}>
                            PUBLIC NODE
                        </div>

                        <div style={{ width: "100%", display: "grid", gap: 8, marginBottom: 14 }}>
                            <input
                                value={channelForm.name}
                                onChange={(e) => setChannelForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="channel name"
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(0,0,0,0.45)",
                                    color: "white",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            />
                            <input
                                value={channelForm.displayName}
                                onChange={(e) => setChannelForm((prev) => ({ ...prev, displayName: e.target.value }))}
                                placeholder="my name in this channel"
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(0,0,0,0.45)",
                                    color: "white",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            />
                            <button
                                onClick={saveChannelSettings}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: `1px solid ${c1}`,
                                    background: "rgba(255,255,255,0.08)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontFamily: "monospace"
                                }}
                            >
                                SAVE CHANNEL
                            </button>
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

            {contactAction === "deleteForever" && selectedContact && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.68)",
                        backdropFilter: "blur(12px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10000,
                        fontFamily: "monospace"
                    }}
                    onClick={() => setContactAction(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 300,
                            padding: 20,
                            borderRadius: 14,
                            border: "1px solid #ff4d5e",
                            background: "rgba(20,0,8,0.85)",
                            color: "white",
                            textAlign: "center"
                        }}
                    >
                        <div style={{ fontSize: 14, marginBottom: 8 }}>
                            delete {selectedContact.displayName} forever?
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 16, lineHeight: 1.5 }}>
                            This removes the contact and permanently deletes the shared chat history.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button
                                onClick={() => setContactAction(null)}
                                style={{
                                    flex: 1,
                                    padding: 8,
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "transparent",
                                    color: "white",
                                    cursor: "pointer"
                                }}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={deleteSelectedContactForever}
                                style={{
                                    flex: 1,
                                    padding: 8,
                                    borderRadius: 8,
                                    border: "none",
                                    background: "linear-gradient(135deg, #ff4d5e, #ff7ad9)",
                                    color: "white",
                                    cursor: "pointer"
                                }}
                            >
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ENLARGED IMAGE MODAL */}
            {enlargedImage && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0, 0, 0, 0.85)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 100000,
                        backdropFilter: "blur(10px)",
                        cursor: "pointer"
                    }}
                    onClick={() => setEnlargedImage(null)}
                >
                    <img
                        src={enlargedImage}
                        alt="enlarged"
                        style={{
                            maxWidth: "90%",
                            maxHeight: "90%",
                            borderRadius: "12px",
                            boxShadow: "0 0 30px rgba(0,0,0,0.5)",
                            border: `1px solid ${c1}`
                        }}
                    />
                    <div style={{
                        position: "absolute",
                        top: 20,
                        right: 30,
                        color: "white",
                        fontFamily: "monospace",
                        fontSize: "24px",
                        fontWeight: "bold",
                        cursor: "pointer"
                    }}>
                        ✕
                    </div>
                </div>
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
                @keyframes typingDot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
