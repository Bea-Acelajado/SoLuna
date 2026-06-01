import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
    collection, query, where, onSnapshot, doc, getDoc
} from "firebase/firestore";

export default function ContactsList({ currentUser, selectedContact, onSelectContact, c1, c2 }) {
    const [contacts, setContacts] = useState([]); // [{ uid, displayName, email, photoURL }]
    const [profiles, setProfiles] = useState({});

    useEffect(() => {
        if (!currentUser) return;

        // Listen to contactRequests where I am the SENDER and request is accepted
        const sentQ = query(
            collection(db, "contactRequests"),
            where("senderId", "==", currentUser.uid),
            where("status", "==", "accepted")
        );

        // Listen to contactRequests where I am the RECEIVER and request is accepted
        const receivedQ = query(
            collection(db, "contactRequests"),
            where("receiverId", "==", currentUser.uid),
            where("status", "==", "accepted")
        );

        const seenUids = new Map(); // uid → contact data

        const merge = () => {
            setContacts(Array.from(seenUids.values()));
        };

        const unsubSent = onSnapshot(sentQ, (snap) => {
            snap.forEach((docSnap) => {
                const data = docSnap.data();
                // I am the sender → the contact is the receiver
                seenUids.set(data.receiverId, {
                    uid: data.receiverId,
                    displayName: data.receiverName || data.receiverEmail?.split("@")[0] || "Unknown",
                    email: data.receiverEmail || "",
                    photoURL: data.receiverPhoto || "",
                });
            });
            // Remove contacts no longer in this snapshot (in case of deletions)
            // We rebuild from both snapshots on any change
            merge();
        });

        const unsubReceived = onSnapshot(receivedQ, (snap) => {
            snap.forEach((docSnap) => {
                const data = docSnap.data();
                // I am the receiver → the contact is the sender
                seenUids.set(data.senderId, {
                    uid: data.senderId,
                    displayName: data.senderName || data.senderEmail?.split("@")[0] || "Unknown",
                    email: data.senderEmail || "",
                    photoURL: data.senderPhoto || "",
                });
            });
            merge();
        });

        return () => {
            unsubSent();
            unsubReceived();
        };
    }, [currentUser]);

    // Fetch live profiles (for online status) whenever contact list changes
    useEffect(() => {
        if (contacts.length === 0) {
            setProfiles({});
            return;
        }

        const unsubscribers = contacts.map((contact) =>
            onSnapshot(doc(db, "users", contact.uid), (docSnap) => {
                if (docSnap.exists()) {
                    setProfiles((prev) => ({
                        ...prev,
                        [contact.uid]: docSnap.data(),
                    }));
                }
            })
        );

        return () => unsubscribers.forEach((u) => u());
    }, [contacts]);

    const formatLastActive = (timestamp) => {
        if (!timestamp) return "Never";
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    if (contacts.length === 0) {
        return (
            <div style={{ padding: "20px", textAlign: "center", fontSize: "11px", opacity: 0.5, fontFamily: "monospace" }}>
                NO CONTACTS ALIGNED YET
            </div>
        );
    }

    return (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
            <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: 2, paddingLeft: 8, paddingBottom: 4 }}>
                CONTACTS ALIGNED
            </div>
            {contacts.map((contact) => {
                const profile = profiles[contact.uid] || contact;
                const isOnline = profile.status === "online";
                const isSelected = selectedContact?.uid === contact.uid;

                return (
                    <div
                        key={contact.uid}
                        onClick={() => onSelectContact({ ...profile, uid: contact.uid })}
                        style={{
                            padding: "10px",
                            marginTop: 6,
                            borderRadius: 10,
                            cursor: "pointer",
                            background: isSelected
                                ? `linear-gradient(135deg, ${c1}, ${c2})`
                                : "transparent",
                            transition: "background 0.3s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 10
                        }}
                    >
                        {/* Status Avatar */}
                        <div style={{ position: "relative" }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,0.1)",
                                border: `1px solid ${isSelected ? "white" : c1}`,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                fontSize: "14px",
                                fontWeight: "bold"
                            }}>
                                {profile.displayName ? profile.displayName[0].toUpperCase() : "👤"}
                            </div>
                            <div style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: isOnline ? "#4de1ff" : "#555",
                                border: "2px solid black"
                            }} />
                        </div>

                        {/* Contact details */}
                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                            <div style={{
                                fontSize: "13px",
                                fontWeight: isSelected ? "bold" : "normal",
                                color: "white",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {profile.displayName}
                            </div>
                            <div style={{
                                fontSize: "9px",
                                opacity: 0.6,
                                fontFamily: "monospace",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {isOnline ? "Online" : `Last active: ${formatLastActive(profile.lastActive)}`}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
