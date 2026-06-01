import { useEffect, useState } from "react";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider 
} from "firebase/auth";
import { auth } from "../firebase";

function getTimeframe() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 6) return "sunrise";
    if (hour >= 6 && hour < 11) return "morning";
    if (hour >= 11 && hour < 13) return "midday";
    if (hour >= 13 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 19) return "sunset";
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

function getBackground() {
    const backgrounds = {
        sunrise: "/sunrisehomepage.png",
        morning: "/morningafternoonhomepage.png",
        midday: "/dayhomepage.png",
        afternoon: "/morningafternoonhomepage.png",
        sunset: "/sunsethomepage.png",
        night: "/nighthomepage.png",
    };
    return backgrounds[getTimeframe()];
}

export default function HomePage({ user, onEnter }) {
    const [time, setTime] = useState("");
    const [warp, setWarp] = useState(false);
    const [status, setStatus] = useState("");
    const [phaseText, setPhaseText] = useState(
        getTimeframe().toUpperCase()
    );

    // Auth States
    const [showAuthForm, setShowAuthForm] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    const background = getBackground();
    const [c1, c2] = getColors();

    const inputStyle = {
        width: "100%",
        padding: "12px 16px",
        margin: "8px 0",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "10px",
        color: "white",
        fontSize: "14px",
        fontFamily: "monospace",
        outline: "none",
        boxSizing: "border-box",
        transition: "border 0.3s ease",
    };

    const buttonStyle = {
        width: "100%",
        padding: "12px",
        margin: "12px 0 6px 0",
        borderRadius: "10px",
        border: "none",
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        color: "white",
        fontWeight: "bold",
        fontSize: "14px",
        cursor: "pointer",
        boxShadow: `0 0 15px rgba(184, 77, 255, 0.3)`,
        letterSpacing: "1px",
    };

    const secondaryButtonStyle = {
        width: "100%",
        padding: "10px",
        margin: "4px 0",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.05)",
        color: "white",
        fontSize: "13px",
        cursor: "pointer",
        fontFamily: "monospace",
    };

    function handleEnter() {
        setStatus("AUTHENTICATING...");

        setTimeout(() => {
            setStatus("CONNECTING TO NEBULAE...");
        }, 500);

        setTimeout(() => {
            setStatus("OPENING CHAT CHANNEL...");
        }, 1500);

        setTimeout(() => {
            setStatus("ACCESS GRANTED");
        }, 2500);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("???");
        }, 3500);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("NIGHT");
        }, 4000);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("SUNRISE");
        }, 4500);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("MORNING");
        }, 5000);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("DAY");
        }, 5500);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("AFTERNOON");
        }, 6000);

        // time phase collapse
        setTimeout(() => {
            setPhaseText("SUNSET");
        }, 6500);

        setTimeout(() => {
            setPhaseText("NIGHT");
        }, 7000);

        setTimeout(() => {
            setPhaseText("UNKNOWN");
        }, 7500);

        setTimeout(() => {
            setPhaseText("TRANSCENDING");
        }, 8000);

        setTimeout(() => {
            setWarp(true);
        }, 8500);

        setTimeout(() => {
            onEnter();
        }, 10100);
    }

    function handleEnterClick() {
        if (user) {
            handleEnter();
        } else {
            setShowAuthForm(true);
        }
    }

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        setAuthLoading(true);
        setError("");
        try {
            await signInWithPopup(auth, provider);
            setShowAuthForm(false);
            handleEnter();
        } catch (err) {
            setError(err.message.replace("Firebase: ", "") || "Google Sign-In failed.");
            setAuthLoading(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError("Credentials are required.");
            return;
        }
        setAuthLoading(true);
        setError("");
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email.trim(), password);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
            setShowAuthForm(false);
            handleEnter();
        } catch (err) {
            setError(err.message.replace("Firebase: ", "") || "Authentication failed.");
            setAuthLoading(false);
        }
    };

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, "0");
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            setTime(`${hours}:${minutes} ${ampm}`);
        };

        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div
                className={warp ? "warp" : ""}
                style={{
                    height: "100vh",
                    width: "100%",
                    backgroundImage: `url(${background})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "column",
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.45))",
                    }}
                />

                <div
                    className={
                        warp ? "nebula-overlay active" : "nebula-overlay"
                    }
                />

                <div className={warp ? "flash active" : "flash"} />

                <div
                    className={
                        warp ? "hud-panel transforming" : "hud-panel"
                    }
                    style={{
                        position: "relative",
                        zIndex: 5,
                        background: warp
                            ? "radial-gradient(circle, rgba(255,120,255,0.4), rgba(120,120,255,0.35), rgba(0,200,255,0.25))"
                            : "rgba(0,0,0,0.25)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "24px",
                        padding: "35px",
                        minWidth: "320px",
                        boxShadow: "0 0 35px rgba(255,255,255,0.08)",
                    }}
                >
                    <h1
                        style={{
                            color: "white",
                            fontSize: "4rem",
                            margin: 0,
                            marginBottom: "15px",
                            fontWeight: "700",
                        }}
                    >
                        SoLuna
                    </h1>

                    <p
                        className="phase-shift"
                        style={{
                            color: "#ddd",
                            fontSize: "11px",
                            letterSpacing: "4px",
                            marginBottom: "10px",
                        }}
                    >
                        TIME PHASE: {phaseText}
                    </p>

                    {showAuthForm && !status ? (
                        <form onSubmit={handleEmailSubmit} style={{ marginTop: "15px", textAlign: "left" }}>
                            <div style={{ fontSize: "10px", opacity: 0.6, letterSpacing: "2px", marginBottom: "8px", textTransform: "uppercase" }}>
                                {isSignUp ? "Create Cosmic Account" : "Access Secret Channel"}
                            </div>
                            
                            {error && (
                                <div style={{ color: "#ff4d6b", fontSize: "11px", marginBottom: "8px", fontFamily: "monospace" }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <input
                                type="email"
                                placeholder="EMAIL ADDRESS"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={inputStyle}
                                disabled={authLoading}
                                required
                            />

                            <input
                                type="password"
                                placeholder="PASSWORD"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={inputStyle}
                                disabled={authLoading}
                                required
                            />

                            <button
                                type="submit"
                                style={buttonStyle}
                                disabled={authLoading}
                            >
                                {authLoading ? "PROCESSING..." : isSignUp ? "SIGN UP" : "SIGN IN"}
                            </button>

                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                style={secondaryButtonStyle}
                                disabled={authLoading}
                            >
                                {authLoading ? "CONNECTING..." : "⚡ GOOGLE ACCESS"}
                            </button>

                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px", fontSize: "11px" }}>
                                <span 
                                    onClick={() => setIsSignUp(!isSignUp)} 
                                    style={{ color: c2, cursor: "pointer", textDecoration: "underline" }}
                                >
                                    {isSignUp ? "Already registered?" : "New entity?"}
                                </span>
                                <span 
                                    onClick={() => { setShowAuthForm(false); setError(""); }} 
                                    style={{ color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                                >
                                    ABORT
                                </span>
                            </div>
                        </form>
                    ) : (
                        <>
                            <h2
                                style={{
                                    color: "white",
                                    fontSize: "2.3rem",
                                    margin: "0 0 10px 0",
                                    fontWeight: "400",
                                }}
                            >
                                {time}
                            </h2>

                            <p
                                style={{
                                    color: "rgba(255,255,255,0.7)",
                                    fontSize: "12px",
                                    marginBottom: "10px",
                                }}
                            >
                                ● synchronized with nebulae
                            </p>

                            {status && (
                                <div
                                    style={{
                                        marginBottom: "20px",
                                        color: "#8ec5ff",
                                        fontSize: "12px",
                                        letterSpacing: "2px",
                                        fontWeight: "bold",
                                    }}
                                >
                                    ● {status}
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    gap: "30px",
                                    marginBottom: "25px",
                                    color: "white",
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }}>
                                        CPU
                                    </div>
                                    <div>32%</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }}>
                                        MEMORY
                                    </div>
                                    <div>1.4 TB</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }}>
                                        LATENCY
                                    </div>
                                    <div>12ms</div>
                                </div>
                            </div>

                            <button
                                onClick={handleEnterClick}
                                style={{
                                    padding: "15px 30px",
                                    borderRadius: "14px",
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "rgba(255,255,255,0.08)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                    boxShadow: `0 0 15px rgba(255,255,255,0.05)`,
                                    transition: "all 0.3s ease",
                                }}
                            >
                                {user ? "ENTER CHAT" : "ACCESS PORTAL"}
                            </button>
                        </>
                    )}
                </div>
            </div>



            <style>
                {`
                .phase-shift {
                    animation: phaseShift 0.4s ease;
                }


                @keyframes phaseShift {
                    0% {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }


                .hud-panel {
                    transition: all 1.8s ease;
                }


                .hud-panel.transforming {
                    animation: nebulaPanel 1.8s forwards;
                }


                @keyframes nebulaPanel {
                    0% {
                        background: rgba(0,0,0,0.25);
                        box-shadow: 0 0 35px rgba(255,255,255,0.08);
                    }
                    30% {
                        background: radial-gradient(circle, rgba(255,120,255,0.35), rgba(120,120,255,0.25));
                        box-shadow: 0 0 40px rgba(255,120,255,0.5);
                    }
                    60% {
                        background: radial-gradient(circle, rgba(255,120,255,0.7), rgba(120,120,255,0.6), rgba(0,200,255,0.5));
                        box-shadow: 0 0 100px rgba(255,120,255,0.8);
                    }
                    100% {
                        background: radial-gradient(circle, rgba(255,120,255,1), rgba(120,120,255,1), rgba(0,200,255,1));
                        box-shadow: 0 0 250px rgba(255,120,255,1);
                        transform: scale(1.4);
                        opacity: 0;
                    }
                }


                .hud-panel.transforming h1,
                .hud-panel.transforming h2,
                .hud-panel.transforming p,
                .hud-panel.transforming button {
                    animation: textFade 1.8s forwards;
                }


                @keyframes textFade {
                    0% { opacity: 1; }
                    60% { opacity: 1; }
                    100% {
                        opacity: 0;
                        filter: blur(10px);
                    }
                }


                .warp {
                    animation: warpJump 1.8s forwards;
                }


                @keyframes warpJump {
                    0% { transform: scale(1); filter: blur(0px); }
                    40% { transform: scale(1.08); filter: blur(3px); }
                    75% { transform: scale(1.25); filter: blur(8px); }
                    100% { transform: scale(1.6); filter: blur(18px); }
                }


                .nebula-overlay {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(255,120,255,0.95) 0%, rgba(180,120,255,0.85) 25%, rgba(120,120,255,0.7) 50%, rgba(0,200,255,0.5) 75%, transparent 100%);
                    opacity: 0;
                    transform: scale(0.2);
                    pointer-events: none;
                    z-index: 3;
                }


                .nebula-overlay.active {
                    animation: nebulaExpand 1.8s forwards;
                }


                @keyframes nebulaExpand {
                    0% { opacity: 0; transform: scale(0.2); }
                    30% { opacity: 0.5; }
                    60% { opacity: 0.9; }
                    100% { opacity: 1; transform: scale(4); }
                }


                .flash {
                    position: absolute;
                    inset: 0;
                    background: black;
                    opacity: 0;
                    pointer-events: none;
                    z-index: 4;
                }


                .flash.active {
                    animation: finalFlash 1.8s forwards;
                }


                @keyframes finalFlash {
                    0% { opacity: 0; }
                    80% { opacity: 0; }
                    100% { opacity: 1; }
                }
                `}
            </style>
        </>
    );
}