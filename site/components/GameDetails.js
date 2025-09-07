import { useEffect, useRef, useState } from "react";

export default function GameDetails({ game, subtitleTextWhite = false }) {
  const [rotated, setRotated] = useState(true);
  const [bounce, setBounce] = useState(false);
  const prevNameRef = useRef(game?.name);

  useEffect(() => {
    if (!game) return;
    if (prevNameRef.current !== game.name) {
      setRotated(false);
      setBounce(true);
      const rotateTimeout = setTimeout(() => {
        setRotated(true);
      }, 180);

      const bounceTimeout = setTimeout(() => {
        setBounce(false);
      }, 350);

      prevNameRef.current = game.name;
      return () => {
        clearTimeout(rotateTimeout);
        clearTimeout(bounceTimeout);
      };
    }
  }, [game?.name]);

  if (!game) return null;

  const titleStyle = {
    fontSize: 96,
    lineHeight: 1.05,
    fontFamily: "'GT Maru Mega', Arial, Helvetica, sans-serif",
    fontWeight: 400,
    color: game.bgColor,
    letterSpacing: bounce ? "0.1em" : "0.03em",
    transition:
      "color 0.5s ease-in-out, transform 0.25s cubic-bezier(.4,2,.6,1), width 0.35s cubic-bezier(.4,2,.6,1), letter-spacing 0.25s cubic-bezier(.4,2,.6,1)",
    textShadow: [
      // Black outline (inner)
      "-4px -4px 0 #000", "4px -4px 0 #000", "-4px 4px 0 #000", "4px 4px 0 #000",
      "0 -4px 0 #000", "0 4px 0 #000", "-4px 0 0 #000", "4px 0 0 #000",
      // Stronger white outline (outer, more layers, larger offsets)
      "-16px -16px 0 #fff", "16px -16px 0 #fff", "-16px 16px 0 #fff", "16px 16px 0 #fff",
      "0 -16px 0 #fff", "0 16px 0 #fff", "-16px 0 0 #fff", "16px 0 0 #fff",
      "-12px -12px 0 #fff", "12px -12px 0 #fff", "-12px 12px 0 #fff", "12px 12px 0 #fff",
      "0 -12px 0 #fff", "0 12px 0 #fff", "-12px 0 0 #fff", "12px 0 0 #fff",
      "-8px -8px 0 #fff", "8px -8px 0 #fff", "-8px 8px 0 #fff", "8px 8px 0 #fff",
      "0 -8px 0 #fff", "0 8px 0 #fff", "-8px 0 0 #fff", "8px 0 0 #fff",
      // Slightly closer white for smoothness
      "-6px -6px 0 #fff", "6px -6px 0 #fff", "-6px 6px 0 #fff", "6px 6px 0 #fff",
      "0 -6px 0 #fff", "0 6px 0 #fff", "-6px 0 0 #fff", "6px 0 0 #fff"
    ].join(", "),
    transform: `${rotated
      ? "perspective(600px) rotateX(30deg)"
      : "perspective(600px) rotateX(-5deg)"} scaleX(${bounce ? 1.18 : 1})`,
    display: "inline-block",
    willChange: "transform, letter-spacing",
  };

  return (
    <div
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <p style={titleStyle}>{game.name}</p>
      <p style={{ 
        fontSize: 18, 
        opacity: 0.5,
        color: subtitleTextWhite ? '#ffffff' : 'inherit'
      }}>{game.description}</p>
    </div>
  );
}
