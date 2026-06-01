import { useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";

export default function UserSearch({ currentUser, c1, c2 }) {
    const [searchQueryTerm, setSearchQueryTerm] = useState("");
    const [foundUsers, setFoundUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSearch = async (e) => {
        e.preventDefault();
        const term = searchQueryTerm.trim();
        if (!term) return;
        
        if (term.toLowerCase() === currentUser.email.toLowerCase() || 
            term.toLowerCase() === (currentUser.displayName || "").toLowerCase()) {
            setError("You cannot search for yourself.");
            setFoundUsers([]);
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");
        setFoundUsers([]);

        const termLower = term.toLowerCase();
        // Prefix range end: replace last char with next unicode char so "hash" matches "hashtag..."
        const termEnd = termLower.slice(0, -1) + String.fromCharCode(termLower.charCodeAt(termLower.length - 1) + 1);

        console.log("[UserSearch] Prefix searching:", termLower, "→", termEnd);

        try {
            // Prefix range search on searchName (displayName lowercase): "hash" finds "hashtag delulu writer"
            const usernameQuery = query(
                collection(db, "users"),
                where("searchName", ">=", termLower),
                where("searchName", "<", termEnd)
            );
            // Exact match on email (emails are typed in full usually)
            const emailQuery = query(
                collection(db, "users"),
                where("email", ">=", termLower),
                where("email", "<", termEnd)
            );

            const [usernameSnap, emailSnap] = await Promise.all([
                getDocs(usernameQuery),
                getDocs(emailQuery),
            ]);

            console.log("[UserSearch] username results:", usernameSnap.size, "| email results:", emailSnap.size);

            const results = [];
            const seenUids = new Set();

            // Merge results, exclude self
            [usernameSnap, emailSnap].forEach((snap) => {
                snap.forEach((docSnap) => {
                    if (docSnap.id !== currentUser.uid && !seenUids.has(docSnap.id)) {
                        seenUids.add(docSnap.id);
                        results.push({ id: docSnap.id, ...docSnap.data() });
                    }
                });
            });

            console.log("[UserSearch] Final results:", results);

            if (results.length === 0) {
                setError("No traveler found with that email or username.");
            } else {
                setFoundUsers(results);
            }
        } catch (err) {
            console.error("[UserSearch] Search error:", err);
            setError("Failed to execute search. Check Firestore security rules.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (targetUser) => {
        if (!targetUser || !currentUser) return;
        setLoading(true);
        setError("");
        setSuccess("");

        const requestId = currentUser.uid < targetUser.uid 
            ? `${currentUser.uid}_${targetUser.uid}` 
            : `${targetUser.uid}_${currentUser.uid}`;

        try {
            // Check if request already exists
            const requestRef = doc(db, "contactRequests", requestId);
            const requestSnap = await getDoc(requestRef);

            if (requestSnap.exists()) {
                const data = requestSnap.data();
                if (data.status === "accepted") {
                    setError("This entity is already in your contacts.");
                } else if (data.status === "pending") {
                    setError(data.senderId === currentUser.uid 
                        ? "Contact request is already pending." 
                        : "They have already sent you a request! Check your Requests tab."
                    );
                } else {
                    // Resend if previously declined
                    await setDoc(requestRef, {
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || currentUser.email.split("@")[0],
                        senderEmail: currentUser.email,
                        receiverId: targetUser.uid,
                        receiverEmail: targetUser.email,
                        receiverName: targetUser.displayName || targetUser.email.split("@")[0],
                        status: "pending",
                        timestamp: Date.now()
                    });
                    setSuccess(`Contact request sent to ${targetUser.displayName}!`);
                    setFoundUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
                }
            } else {
                // Check if they are already in contacts subcollection
                const contactRef = doc(db, "users", currentUser.uid, "contacts", targetUser.uid);
                const contactSnap = await getDoc(contactRef);

                if (contactSnap.exists()) {
                    setError("This entity is already in your contacts.");
                } else {
                    // Create new pending request
                    await setDoc(requestRef, {
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || currentUser.email.split("@")[0],
                        senderEmail: currentUser.email,
                        receiverId: targetUser.uid,
                        receiverEmail: targetUser.email,
                        receiverName: targetUser.displayName || targetUser.email.split("@")[0],
                        status: "pending",
                        timestamp: Date.now()
                    });
                    setSuccess(`Signal request transmitted to ${targetUser.displayName}!`);
                    setFoundUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
                }
            }
        } catch (err) {
            console.error("Error sending request:", err);
            setError("Failed to transmit request. Check security rules.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 6 }}>
                <input
                    type="text"
                    placeholder="USERNAME OR EMAIL..."
                    value={searchQueryTerm}
                    onChange={(e) => setSearchQueryTerm(e.target.value)}
                    style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        outline: "none",
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                        color: "white",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontFamily: "monospace"
                    }}
                    disabled={loading}
                >
                    {loading ? "..." : "SCAN"}
                </button>
            </form>

            {error && (
                <div style={{ color: "#ff4d6b", fontSize: "11px", marginTop: 6, fontFamily: "monospace" }}>
                    ⚠️ {error}
                </div>
            )}

            {success && (
                <div style={{ color: "#4de1ff", fontSize: "11px", marginTop: 6, fontFamily: "monospace" }}>
                    ✓ {success}
                </div>
            )}

            {foundUsers.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {foundUsers.map((fUser) => (
                        <div
                            key={fUser.id}
                            style={{
                                padding: 8,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                display: "flex",
                                justifySpaceBetween: "space-between",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}
                        >
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>
                                <div style={{ fontSize: "13px", fontWeight: "bold", color: "white" }}>
                                    {fUser.displayName}
                                </div>
                                <div style={{ fontSize: "10px", opacity: 0.6, fontFamily: "monospace" }}>
                                    {fUser.email}
                                </div>
                            </div>
                            <button
                                onClick={() => handleSendRequest(fUser)}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: `1px solid ${c1}`,
                                    background: "transparent",
                                    color: "white",
                                    fontSize: "10px",
                                    cursor: "pointer",
                                    fontFamily: "monospace",
                                    whiteSpace: "nowrap"
                                }}
                                disabled={loading}
                            >
                                CONNECT
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
