import { useState, useEffect } from "react";

export default function MatchaModal({ isOpen, playSound, playClip, stopAll, isMuted, token, SlackId, profile, onClose }) {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isExiting, setIsExiting] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showCallToAction, setShowCallToAction] = useState(false);
  const [stage, setStage] = useState(0);
  const [userGames, setUserGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [hackatimeProjects, setHackatimeProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [connectingProjects, setConnectingProjects] = useState(false);

  // Function to handle closing the modal
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsExiting(false);
      // Reset all state when closing
      setShowTitle(false);
      setShowDescription(false);
      setShowButton(false);
      setShowCallToAction(false);
      setStage(0);
      setUserGames([]);
      setSelectedGame(null);
      setHackatimeProjects([]);
      setSelectedProjects([]);
      setLoadingGames(false);
      setLoadingProjects(false);
      setConnectingProjects(false);
      onClose?.();
    }, 260);
  };

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsExiting(false);
        
              // Reset animation states and stage
      setShowTitle(false);
      setShowDescription(false);
      setShowButton(false);
      setShowCallToAction(false);
      setStage(0);
      setUserGames([]);
      setSelectedGame(null);
      setHackatimeProjects([]);
      setSelectedProjects([]);
      setLoadingGames(false);
      setLoadingProjects(false);
      setConnectingProjects(false);
        
              // Animate elements in sequence after modal enters
      setTimeout(() => setShowTitle(true), 300);
      setTimeout(() => setShowDescription(true), 1300);
      setTimeout(() => setShowButton(true), 2800);
      setTimeout(() => setShowCallToAction(true), 3800);
      });
    } else if (shouldRender) {
      setIsExiting(true);
      const t = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [isOpen, shouldRender]);



  // Fetch user games when stage 1 is reached
  useEffect(() => {
    if (stage === 1 && token && userGames.length === 0 && !loadingGames) {
      setLoadingGames(true);
      fetch('/api/GetMyGames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => res.json())
      .then(games => {
        setUserGames(games || []);
        setLoadingGames(false);
      })
      .catch(error => {
        console.error('Failed to fetch games:', error);
        setLoadingGames(false);
      });
    }
  }, [stage, token, userGames.length, loadingGames]);

  // Fetch Hackatime projects when a game is selected
  useEffect(() => {
    if (selectedGame && token && SlackId && hackatimeProjects.length === 0 && !loadingProjects) {
      setLoadingProjects(true);
      let url = `/api/hackatimeProjects?slackId=${encodeURIComponent(SlackId)}&gameId=${encodeURIComponent(selectedGame.id)}`;
      if (profile?.email) {
        url += `&email=${encodeURIComponent(profile.email)}`;
      }
      fetch(url)
      .then(res => res.json())
      .then(data => {
        setHackatimeProjects(data.projects || []);
        setLoadingProjects(false);
      })
      .catch(error => {
        console.error('Failed to fetch Hackatime projects:', error);
        setLoadingProjects(false);
      });
    }
  }, [selectedGame, token, SlackId, hackatimeProjects.length, loadingProjects, profile?.email]);

  if (!shouldRender) return null;

  return (
    <div
      className={`modal-overlay ${isExiting ? "exit" : "enter"}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        className={`modal-card ${isExiting ? "exit" : "enter"}`}
        style={{
          background: "#d4edda",
          border: "4px solid #90EE90",
          borderRadius: 12,
          minWidth: 320,
          maxWidth: 420,
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            color: "#2E8B57",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            transition: "all 0.2s ease",
            zIndex: 1,
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(46, 139, 87, 0.1)";
            e.target.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "none";
            e.target.style.transform = "scale(1)";
          }}
        >
          ×
        </button>

        {stage === 0 && (
          <>
            <h2 
              className={`fade-in ${showTitle ? 'visible' : ''}`}
              style={{ 
                margin: 0, 
                fontSize: "28px", 
                fontWeight: "bold", 
                color: "#2E8B57", 
                marginBottom: "16px", 
                textAlign: "center",
                opacity: 0,
                transform: "translateY(20px)",
                transition: "opacity 1s ease, transform 1s ease"
              }}
            >
              Connect Hackatime to your Shiba Game
            </h2>
            <p 
              className={`fade-in ${showDescription ? 'visible' : ''}`}
              style={{ 
                margin: 0, 
                fontSize: "16px", 
                color: "#2E8B57", 
                lineHeight: "1.5", 
                marginBottom: "12px", 
                textAlign: "left",
                opacity: 0,
                transform: "translateY(20px)",
                transition: "opacity 1s ease, transform 1s ease"
              }}
            >
              Connect your Hackatime projects to your Shiba games to track your development progress and share your work with the community.
            </p>
            <button
              className={`fade-in ${showButton ? 'visible' : ''}`}
              style={{
                appearance: "none",
                border: "2px solid #2E8B57",
                background: "#2E8B57",
                color: "#ffffff",
                borderRadius: 10,
                padding: "12px 24px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                transition: "all 0.2s ease",
                marginBottom: "16px",
                width: "100%",
                opacity: 0,
                transform: "translateY(20px)",
                transition: "opacity 2s ease, transform 2s ease",
              }}
              onClick={() => {
                playSound?.("next.mp3");
                setStage(1);
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#3cb371";
                e.target.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#2E8B57";
                e.target.style.color = "#ffffff";
              }}
            >
              Continue to Connect
            </button>
            <p 
              className={`fade-in ${showCallToAction ? 'visible' : ''}`}
              style={{ 
                margin: 0, 
                fontSize: "16px", 
                color: "#2E8B57", 
                lineHeight: "1.5", 
                fontWeight: "600", 
                textAlign: "left",
                opacity: 0,
                transform: "translateY(20px)",
                transition: "opacity 1s ease, transform 1s ease"
              }}
            >
              Connect a Hackatime project to your Shiba game to get started.
            </p>
          </>
        )}
        
        {stage === 1 && (
          <>
            <h2 
              style={{ 
                margin: 0, 
                fontSize: "28px", 
                fontWeight: "bold", 
                color: "#2E8B57", 
                marginBottom: "16px", 
                textAlign: "center"
              }}
            >
              What's your Shiba Project?
            </h2>
            <p 
              style={{ 
                margin: 0, 
                fontSize: "16px", 
                color: "#2E8B57", 
                lineHeight: "1.5", 
                marginBottom: "20px", 
                textAlign: "left"
              }}
            >
              Select the game you're working on for the Shiba Game Jam.
            </p>
            {loadingGames ? (
              <div style={{ textAlign: "center", color: "#2E8B57", fontSize: "16px" }}>
                Loading your games...
              </div>
            ) : userGames.length === 0 ? (
              <div style={{ textAlign: "center", color: "#2E8B57", fontSize: "16px" }}>
                No games found. Create a game first!
              </div>
            ) : (
              <div style={{ width: "100%", marginBottom: "20px" }}>
                {userGames.map((game) => (
                  <button
                    key={game.id}
                    style={{
                      appearance: "none",
                      border: "2px solid #2E8B57",
                      background: selectedGame?.id === game.id ? "#3cb371" : "#ffffff",
                      color: selectedGame?.id === game.id ? "#ffffff" : "#2E8B57",
                      borderRadius: 10,
                      padding: "12px 16px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "16px",
                      transition: "all 0.2s ease",
                      marginBottom: "8px",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onClick={() => {
                      playSound?.("next.mp3");
                      setSelectedGame(game);
                      setStage(2);
                    }}
                    onMouseEnter={(e) => {
                      if (selectedGame?.id !== game.id) {
                        e.target.style.background = "#f0f8f0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedGame?.id !== game.id) {
                        e.target.style.background = "#ffffff";
                      }
                    }}
                  >
                    {game.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        
        {stage === 2 && (
          <>
            <h2 
              style={{ 
                margin: 0, 
                fontSize: "28px", 
                fontWeight: "bold", 
                color: "#2E8B57", 
                marginBottom: "16px", 
                textAlign: "center"
              }}
            >
              Select Hackatime Project
            </h2>
            <p 
              style={{ 
                margin: 0, 
                fontSize: "16px", 
                color: "#2E8B57", 
                lineHeight: "1.5", 
                marginBottom: "12px", 
                textAlign: "left"
              }}
            >
              Select Hackatime projects to connect to {selectedGame?.name}. (You can select multiple)
            </p>
            <div 
              style={{ 
                width: "100%", 
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden"
              }}
            >
              <iframe
                width="100%"
                height="180"
                src="https://www.youtube.com/embed/a938RgsBzNg?si=qHHBIWW7GsvoyheJ"
                title="Hackatime Tutorial"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{
                  borderRadius: "8px",
                  border: "2px solid #2E8B57"
                }}
              ></iframe>
            </div>
            {loadingProjects ? (
              <div style={{ textAlign: "center", color: "#2E8B57", fontSize: "16px" }}>
                Loading Hackatime projects...
              </div>
            ) : hackatimeProjects.length === 0 ? (
              <div style={{ textAlign: "center", color: "#2E8B57", fontSize: "14px", lineHeight: "1.4" }}>
                <p style={{ marginBottom: "12px" }}>
                  We're not finding any Hackatime projects for your profile.
                </p>
                <p style={{ marginBottom: "12px" }}>
                  Login into <a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2E8B57", textDecoration: "underline" }}>hackatime.hackclub.com</a> with your Slack & go through the <a href="https://hackatime.hackclub.com/docs/editors/godot" target="_blank" rel="noopener noreferrer" style={{ color: "#2E8B57", textDecoration: "underline" }}>Godot Quickstart Guide</a>.
                </p>
                <p style={{ fontSize: "12px", opacity: 0.8 }}>
                  If you get stuck, ask in <a href="https://hackclub.slack.com/archives/C09AUEXD96Z" target="_blank" rel="noopener noreferrer" style={{ color: "#2E8B57", textDecoration: "underline" }}>#shiba-help</a> for help.
                </p>
              </div>
            ) : (
              <div style={{ width: "100%", marginBottom: "20px" }}>
                {hackatimeProjects.map((project, index) => {
                  const isSelected = selectedProjects.includes(project);
                  return (
                    <button
                      key={index}
                      style={{
                        appearance: "none",
                        border: `2px solid ${isSelected ? "#ffffff" : "#2E8B57"}`,
                        background: isSelected ? "#2E8B57" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#2E8B57",
                        borderRadius: 10,
                        padding: "12px 16px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                        transition: "all 0.2s ease",
                        marginBottom: "8px",
                        width: "100%",
                        textAlign: "left",
                        position: "relative",
                      }}
                      onClick={() => {
                        playSound?.("next.mp3");
                        if (isSelected) {
                          setSelectedProjects(selectedProjects.filter(p => p !== project));
                        } else {
                          setSelectedProjects([...selectedProjects, project]);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.target.style.background = "#f0f8f0";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.target.style.background = "#ffffff";
                        }
                      }}
                    >
                      {isSelected && (
                        <span style={{ 
                          position: "absolute", 
                          right: "12px", 
                          top: "50%", 
                          transform: "translateY(-50%)",
                          fontSize: "18px"
                        }}>
                          ✓
                        </span>
                      )}
                      {project}
                    </button>
                  );
                })}
                {selectedProjects.length > 0 && (
                  <div style={{ 
                    marginTop: "16px", 
                    padding: "12px", 
                    background: "#f0f8f0", 
                    borderRadius: "8px",
                    border: "1px solid #2E8B57"
                  }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#2E8B57", fontWeight: "bold" }}>
                      Connect {selectedProjects.length} Hackatime Project{selectedProjects.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      style={{
                        appearance: "none",
                        border: "2px solid #2E8B57",
                        background: "#2E8B57",
                        color: "#ffffff",
                        borderRadius: 10,
                        padding: "12px 16px",
                        cursor: connectingProjects ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                        transition: "all 0.2s ease",
                        marginTop: "12px",
                        width: "100%",
                        opacity: connectingProjects ? 0.8 : 1,
                      }}
                      disabled={connectingProjects}
                      onClick={async () => {
                        if (!selectedGame || selectedProjects.length === 0 || connectingProjects) return;
                        
                        setConnectingProjects(true);
                        try {
                          const res = await fetch('/api/updateGame', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              token,
                              gameId: selectedGame.id,
                              HackatimeProjects: selectedProjects.join(', ')
                            })
                          });
                          
                          const data = await res.json();
                          if (res.ok && data?.ok) {
                            setStage(3); // Move to final stage
                          } else {
                            console.error('Failed to connect projects:', data?.message);
                          }
                        } catch (error) {
                          console.error('Error connecting projects:', error);
                        } finally {
                          setConnectingProjects(false);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!connectingProjects) {
                          e.target.style.background = "#3cb371";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!connectingProjects) {
                          e.target.style.background = "#2E8B57";
                        }
                      }}
                    >
                      {connectingProjects ? "Connecting..." : "Connect Projects"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {stage === 3 && (
          <>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: "bold",
                color: "#2E8B57",
                marginBottom: "16px",
                textAlign: "center"
              }}
            >
              Hackatime Connected!
            </h2>
            <p 
              style={{ 
                margin: 0, 
                fontSize: "16px", 
                color: "#2E8B57", 
                lineHeight: "1.5", 
                marginBottom: "20px", 
                textAlign: "center"
              }}
            >
              Your Hackatime projects have been successfully connected to your Shiba game.
              {profile?.referralCode && " Here's your referral link to invite your friends to join too:"}
            </p>
            
            {profile?.referralCode && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,255,255,0.8)",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                  marginBottom: "20px",
                }}
                onClick={() => {
                  const baseUrl = window.location.origin;
                  const referralUrl = `${baseUrl}?sentby=${profile.referralCode}`;
                  
                  // Track referral code copy with Plausible
                  if (window.plausible) {
                    window.plausible('Referral Code Copied', {
                      props: {
                        referralCode: profile.referralCode,
                        location: 'matcha-modal'
                      }
                    });
                  }
                  
                  navigator.clipboard.writeText(referralUrl).then(() => {
                    // Show a brief success message
                    const originalText = document.querySelector('.matcha-referral-copy-text')?.textContent;
                    const copyText = document.querySelector('.matcha-referral-copy-text');
                    if (copyText) {
                      copyText.textContent = 'Copied!';
                      setTimeout(() => {
                        copyText.textContent = originalText || profile.referralCode;
                      }, 1000);
                    }
                  }).catch(err => {
                    console.error('Failed to copy: ', err);
                  });
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.95)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.8)";
                }}
              >
                <span 
                  className="matcha-referral-copy-text"
                  style={{ 
                    flex: 1, 
                    fontSize: "14px",
                    color: "rgba(0,0,0,0.8)",
                    fontFamily: "monospace",
                    fontWeight: "600"
                  }}
                >
                  {profile.referralCode}
                </span>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ 
                    color: "rgba(0,0,0,0.6)",
                    flexShrink: 0
                  }}
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            )}
            
            <button
              style={{
                appearance: "none",
                border: "2px solid #2E8B57",
                background: "#2E8B57",
                color: "#ffffff",
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                transition: "all 0.2s ease",
                width: "100%",
              }}
              onClick={() => {
                // Close the modal
                handleClose();
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#3cb371";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#2E8B57";
              }}
            >
              Complete Connection
            </button>
          </>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .modal-overlay {
          background-color: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          transition:
            backdrop-filter 240ms ease,
            -webkit-backdrop-filter 240ms ease,
            background-color 240ms ease;
        }
        .modal-overlay.enter {
          background-color: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .modal-overlay.exit {
          background-color: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }
        .modal-card {
          transform: translateY(6px) scale(0.98);
          opacity: 0;
          transition:
            transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 220ms ease;
        }
        .modal-card.enter {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        .modal-card.exit {
          transform: translateY(6px) scale(0.98);
          opacity: 0;
        }
        .fade-in.visible {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `}</style>
    </div>
  );
}
