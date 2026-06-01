import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import HomePage from "./pages/homepage";
import ChatPage from "./pages/chatpage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("home");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const displayName = currentUser.displayName || currentUser.email.split("@")[0];
          await setDoc(
            doc(db, "users", currentUser.uid),
            {
              uid: currentUser.uid,
              email: currentUser.email.toLowerCase(),
              displayName,
              searchName: displayName.toLowerCase(),
              photoURL: currentUser.photoURL || "",
              status: "online",
              lastActive: Date.now(),
            },
            { merge: true }
          );
        } catch (error) {
          console.error("Failed to sync user profile to Firestore:", error);
        }
      }
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        setPage("home");
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#b84dff",
        fontSize: "1.2rem",
        fontFamily: "monospace",
        letterSpacing: "4px",
        textShadow: "0 0 10px rgba(184, 77, 255, 0.5)"
      }}>
        ● INITIALIZING NEBULAE...
      </div>
    );
  }

  if (page === "home") {
    return <HomePage user={user} onEnter={() => setPage("chat")} />;
  }

  return <ChatPage user={user} />;
}

export default App;