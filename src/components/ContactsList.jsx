import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";

const STATUS_COLORS = {
    online: "#36e68a",
    idle: "#ffd166",
    dnd: "#ff4d5e",
    offline: "#777",
};

const STATUS_LABELS = {
    online: "Online",
    idle: "Idle",
    dnd: "Do not disturb",
    offline: "Offline",
};

export default function ContactsList({ currentUser, selectedContact, onSelectContact, c1 }) {
    const [contacts, setContacts] = useState([]);
    const [profiles, setProfiles] = useState({});

    useEffect(() => {
        if (!currentUser) return;

        const contactsRef = collection(db, "users", currentUser.uid, "contacts");
        const unsubscribe = onSnapshot(
            contactsRef,
            (snap) => {
                const list = snap.docs
                    .map((docSnap) => {
                        const data = docSnap.data();
                        return {
                            uid: data.contactUid || docSnap.id,
                            displayName: data.displayName || data.email?.split("@")[0] || "Unknown",
                            email: data.email || "",
                            photoURL: data.photoURL || "",
                            nickname: data.nickname || "",
                            myDisplayName: data.myDisplayName || "",
                            archived: data.archived === true,
                            addedAt: data.addedAt || 0,
                        };
                    })
                    .filter((contact) => !contact.archived)
                    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

                setContacts(list);
            },
            (error) => {
                console.error("Failed to load saved contacts:", error);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

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

        return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
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
                const profile = profiles[contact.uid] || {};
                const status = profile.status || "offline";
                const displayName = contact.nickname || profile.displayName || contact.displayName;
                const photoURL = profile.photoURL || contact.photoURL;
                const isSelected = selectedContact?.uid === contact.uid;

                return (
                    <div
                        key={contact.uid}
                        onClick={() => onSelectContact({
                            ...contact,
                            ...profile,
                            uid: contact.uid,
                            contactDisplayName: contact.displayName,
                            nickname: contact.nickname,
                            myDisplayName: contact.myDisplayName,
                            displayName,
                            photoURL,
                            status,
                        })}
                        style={{
                            padding: "10px",
                            marginTop: 6,
                            borderRadius: 10,
                            cursor: "pointer",
                            background: isSelected ? `linear-gradient(135deg, ${c1}, rgba(255,255,255,0.1))` : "transparent",
                            transition: "background 0.3s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 10
                        }}
                    >
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
                                fontWeight: "bold",
                                overflow: "hidden"
                            }}>
                                {photoURL ? (
                                    <img src={photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    displayName ? displayName[0].toUpperCase() : "?"
                                )}
                            </div>
                            <div style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: STATUS_COLORS[status] || STATUS_COLORS.offline,
                                border: "2px solid black"
                            }} />
                        </div>

                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                            <div style={{
                                fontSize: "13px",
                                fontWeight: isSelected ? "bold" : "normal",
                                color: "white",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {displayName}
                            </div>
                            <div style={{
                                fontSize: "9px",
                                opacity: 0.6,
                                fontFamily: "monospace",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {STATUS_LABELS[status] || "Offline"} · {status === "offline" ? `Last active: ${formatLastActive(profile.lastActive)}` : contact.email}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
