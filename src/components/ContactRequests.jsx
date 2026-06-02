import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, deleteDoc, setDoc } from "firebase/firestore";

export default function ContactRequests({ currentUser, c1, c2 }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "contactRequests"),
            where("receiverId", "==", currentUser.uid),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            setRequests(list);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleAccept = async (request) => {
        setLoading(true);
        try {
            const batch = writeBatch(db);

            // 1. Mark request as accepted
            const requestRef = doc(db, "contactRequests", request.id);
            batch.update(requestRef, { status: "accepted" });

            // 2. Add sender to MY (receiver's) contacts subcollection — we can write our own
            const senderName = request.senderName || request.senderEmail.split("@")[0];
            const receiverContactRef = doc(db, "users", currentUser.uid, "contacts", request.senderId);
            batch.set(receiverContactRef, {
                contactUid: request.senderId,
                email: request.senderEmail,
                displayName: senderName,
                photoURL: request.senderPhoto || "",
                archived: false,
                addedAt: Date.now()
            });

            await batch.commit();

            // Save the reciprocal contact after the request is accepted so both users hydrate on refresh.
            const senderContactRef = doc(db, "users", request.senderId, "contacts", currentUser.uid);
            await setDoc(senderContactRef, {
                contactUid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split("@")[0],
                photoURL: currentUser.photoURL || "",
                archived: false,
                addedAt: Date.now()
            }, { merge: true });
        } catch (err) {
            console.error("Error accepting request:", err);
            alert("Failed to accept connection request.");
        } finally {
            setLoading(false);
        }
    };


    const handleDecline = async (requestId) => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, "contactRequests", requestId));
        } catch (err) {
            console.error("Error declining request:", err);
            alert("Failed to decline request.");
        } finally {
            setLoading(false);
        }
    };

    if (requests.length === 0) {
        return (
            <div style={{ padding: "12px", textAlign: "center", fontSize: "11px", opacity: 0.5, fontFamily: "monospace" }}>
                NO PENDING SIGNAL REQUESTS
            </div>
        );
    }

    return (
        <div style={{ maxHeight: "200px", overflowY: "auto", padding: "5px 0" }}>
            <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: 2, paddingLeft: 8, paddingBottom: 4 }}>
                PENDING SIGNAL INCOMING ({requests.length})
            </div>
            {requests.map((req) => (
                <div
                    key={req.id}
                    style={{
                        padding: 8,
                        marginBottom: 6,
                        background: "rgba(255, 77, 141, 0.05)",
                        border: "1px solid rgba(255, 77, 141, 0.15)",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                    }}
                >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "white" }}>
                            {req.senderName}
                        </div>
                        <div style={{ fontSize: "10px", opacity: 0.6, fontFamily: "monospace" }}>
                            {req.senderEmail}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button
                            onClick={() => handleAccept(req)}
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "none",
                                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                color: "white",
                                fontSize: "10px",
                                cursor: "pointer",
                                fontFamily: "monospace",
                            }}
                        >
                            ACCEPT
                        </button>
                        <button
                            onClick={() => handleDecline(req.id)}
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid rgba(255,255,255,0.2)",
                                background: "transparent",
                                color: "white",
                                fontSize: "10px",
                                cursor: "pointer",
                                fontFamily: "monospace",
                            }}
                        >
                            DECLINE
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
