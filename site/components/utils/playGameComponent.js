/* eslint-disable react/prop-types */
import React, { useState, useRef } from "react";

/**
 * Renders a game from the Shiba API in an iframe.
 *
 * Props:
 * - gameId: string (required)
 * - width: number|string (optional) iframe width, e.g., 800 or "100%" (default: "100%")
 * - height: number|string (optional) iframe height, e.g., 600 or "600" (default: 600)
 * - apiBase: string (optional) override API base URL; defaults to NEXT_PUBLIC_API_BASE or same-origin
 * - style: React.CSSProperties (optional)
 */
export default function PlayGameComponent({ gameId, width = "100%", apiBase, style, gameName, thumbnailUrl, token, onPlayCreated, onGameStart, gamePageUrl, compact = false }) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_BASE || "";
  const normalizedWidth = typeof width === "number" ? `${width}` : width;
  const [started, setStarted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const iframeRef = useRef(null);

  if (!gameId) {
    return <div>Missing gameId.</div>;
  }

  const url = `${base}/play/${encodeURIComponent(gameId)}/`;

  const handleFullScreen = () => {
    if (iframeRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        iframeRef.current.requestFullscreen().catch((err) => {
          console.log("Error attempting to enable fullscreen:", err);
        });
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      const linkToCopy = gamePageUrl || url;
      await navigator.clipboard.writeText(linkToCopy);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleRestart = () => {
    if (iframeRef.current) {
      // Force reload the iframe by updating its src
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        iframeRef.current.src = currentSrc;
      }, 10);
    }
  };

  // Calculate button size based on screen size (small and relative)
  const getButtonSize = () => {
    const screenWidth =
      typeof window !== "undefined" ? window.innerWidth : 1920;
    const screenHeight =
      typeof window !== "undefined" ? window.innerHeight : 1080;
    const minDimension = Math.min(screenWidth, screenHeight);
    // Button size as percentage of screen's smaller dimension
    const sizePercent = 0.04; // 4% of screen's smaller dimension
    const minSize = 24; // Minimum 24px
    const maxSize = 48; // Maximum 48px
    return Math.max(minSize, Math.min(maxSize, minDimension * sizePercent));
  };

  // Aspect-ratio container (always 16:9.6 = 5:3), full width
  return (
    <div
      style={{
        position: "relative",
        width: normalizedWidth,
        aspectRatio: "5 / 3",
        overflow: "hidden",
        ...style,
      }}
    >
      {!started && (
        <button
          type="button"
          onClick={async () => {
            if (animating || started) return;
            try {
              const audio = new Audio("/diskSpin.mp3");
              audio.currentTime = 0;
              // Play may return a promise; safely ignore rejection (e.g., autoplay policies)
              const playPromise = audio.play();
              if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(() => {});
              }
            } catch (_) {}
            setAnimating(true);

            // Create play record if token and gameName are provided
            if (token && gameName) {
              console.log("🎮 PlayGameComponent: Creating play record...");
              console.log("🎮 Token available:", !!token);
              console.log("🎮 Game name:", gameName);
              try {
                const requestBody = { token, gameName };
                console.log(
                  "🎮 Request body:",
                  JSON.stringify(requestBody, null, 2),
                );

                const res = await fetch("/api/CreatePlay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                });
                console.log("🎮 Response status:", res.status);
                console.log("🎮 Response ok:", res.ok);

                const data = await res.json().catch(() => ({}));
                console.log("🎮 Response data:", JSON.stringify(data, null, 2));

                if (res.ok && data?.ok && onPlayCreated) {
                  onPlayCreated(data.play);
                }
              } catch (error) {
                console.error("❌ Failed to create play record:", error);
              }
            } else {
              console.log(
                "🎮 PlayGameComponent: Skipping play record creation",
              );
              console.log("🎮 Token available:", !!token);
              console.log("🎮 Game name available:", !!gameName);
            }

            setTimeout(() => {
              setStarted(true);
              setAnimating(false);
              // Call onGameStart when the game actually starts
              if (onGameStart) {
                onGameStart();
              }
            }, 900);
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: "#444",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
            padding: 16,
            boxSizing: "border-box",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {thumbnailUrl && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${thumbnailUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: "blur(12px) brightness(0.3)",
                transform: "scale(1.1)",
                zIndex: 0,
                imageRendering: "pixelated",
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <div
              className={`cd${animating ? " animating" : ""}`}
              aria-hidden
              style={{
                maxWidth: compact ? "min(120px, 60vw)" : "min(180px, 80vw)",
                maxHeight: compact ? "min(120px, 60vw)" : "min(180px, 80vw)",
                ...(thumbnailUrl
                  ? {
                      backgroundImage: `url(${thumbnailUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      imageRendering: "pixelated",
                    }
                  : undefined)
              }}
            >
              <div className="cd-overlay" />
            </div>
            <p
              style={{
                margin: 0,
                fontWeight: 800,
                opacity: animating ? 0 : 1,
                transition: "opacity 150ms ease-out",
              }}
            >
              {`Tap to start ${gameName ? gameName : "game"}`}
            </p>
          </div>
          <style jsx>{`
            .cd {
              position: relative;
              width: ${compact ? "min(120px, 60vw)" : "min(180px, 80vw)"};
              height: ${compact ? "min(120px, 60vw)" : "min(180px, 80vw)"};
              aspect-ratio: 1;
              border-radius: 100%;
              border: 1px solid grey;
              background: 
                radial-gradient(
                  circle at 40% 40%,
                  #f0f0f0 0%,
                  #d9d9d9 40%,
                  #c7c7c7 70%,
                  #bdbdbd 100%
                ),
                repeating-conic-gradient(
                  from 0deg,
                  transparent 0deg,
                  rgba(0, 0, 0, 0.03) 1deg,
                  transparent 2deg
                );
              transform-origin: center;
              transform-style: preserve-3d;
              will-change: transform;
              animation: spinY 6s linear infinite;
              box-shadow:
                0 0 15px rgba(255, 255, 255, 0.15),
                0 0 30px rgba(255, 255, 255, 0.1),
                inset 0 0 10px rgba(255, 255, 255, 0.05);
            }
            .cd.animating {
              animation: spinZoom 1500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            .cd-overlay {
              position: absolute;
              inset: 0;
              border-radius: inherit;
              pointer-events: none;
              opacity: 0.18;
              background: conic-gradient(
                white,
                white,
                white,
                grey,
                grey,
                violet,
                deepskyblue,
                aqua,
                palegreen,
                yellow,
                orange,
                red,
                grey,
                grey,
                white,
                white,
                white,
                white,
                grey,
                grey,
                violet,
                deepskyblue,
                aqua,
                palegreen,
                yellow,
                orange,
                red,
                grey,
                grey,
                white
              );
              mix-blend-mode: screen;
            }
            .cd::before,
            .cd::after {
              content: "";
              position: absolute;
              top: 50%;
              left: 50%;
              border-radius: inherit;
              box-shadow: 0 0 1px grey;
              box-sizing: border-box;
            }
            .cd::before {
              width: 30%;
              height: 30%;
              margin: -15% 0 0 -15%;
              background: lightgrey;
              background-clip: padding-box;
              border: 10px solid rgba(0, 0, 0, 0.2);
            }
            .cd::after {
              width: 18%;
              height: 18%;
              margin: -9% 0 0 -9%;
              background: #444444;
              background-clip: padding-box;
              border: 10px solid rgba(0, 0, 0, 0.1);
              filter: drop-shadow(0 0 2px grey);
            }
            @keyframes spinY {
              0% {
                transform: rotateY(0deg);
              }
              100% {
                transform: rotateY(360deg);
              }
            }
            @keyframes spinZoom {
              0% {
                transform: rotateY(0deg) scale(1);
              }
              100% {
                transform: rotateY(720deg) scale(8);
              }
            }
            @keyframes fadeInOut {
              0% {
                opacity: 0;
                transform: translateY(-10px);
              }
              20% {
                opacity: 1;
                transform: translateY(0);
              }
              80% {
                opacity: 1;
                transform: translateY(0);
              }
              100% {
                opacity: 0;
                transform: translateY(-10px);
              }
            }
          `}</style>
        </button>
      )}
      {started && (
        <>
          <iframe
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
            credentialless={true}
            ref={iframeRef}
            src={url}
            title={`Play ${gameId}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
            allow="autoplay; fullscreen; cross-origin-isolated"
          />
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 10,
            }}
          >
            <button
              onClick={handleRestart}
              style={{
                width: `${getButtonSize()}px`,
                height: `${getButtonSize()}px`,
                background: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: `${Math.max(12, getButtonSize() * 0.4)}px`,
                backdropFilter: "blur(4px)",
                transition: "all 0.2s ease",
              }}
              title="Restart game"
            >
              <svg
                width="60%"
                height="60%"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>
          </div>
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 10,
            }}
          >
            <button
              onClick={handleCopyLink}
              style={{
                width: linkCopied
                  ? `${getButtonSize() * 4.5}px`
                  : `${getButtonSize()}px`,
                height: `${getButtonSize()}px`,
                background: linkCopied
                  ? "rgba(34, 197, 94, 0.8)"
                  : "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: `${Math.max(12, getButtonSize() * 0.4)}px`,
                backdropFilter: "blur(4px)",
                transition: "all 0.3s ease",
                position: "relative",
                gap: "6px",
                padding: "0 8px",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
              title="Copy game link"
            >
              <svg
                width="60%"
                height="60%"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{
                  width: `${getButtonSize() * 0.5}px`,
                  height: `${getButtonSize() * 0.5}px`,
                  flexShrink: 0,
                }}
              >
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              </svg>
              {linkCopied && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: "bold",
                    opacity: 1,
                    transition: "opacity 0.3s ease",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  copied to clipboard
                </span>
              )}
            </button>
            <button
              onClick={handleFullScreen}
              style={{
                width: `${getButtonSize()}px`,
                height: `${getButtonSize()}px`,
                background: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: `${Math.max(12, getButtonSize() * 0.4)}px`,
                backdropFilter: "blur(4px)",
                transition: "all 0.2s ease",
              }}
              title="Toggle fullscreen"
            >
              <svg
                width="60%"
                height="60%"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
