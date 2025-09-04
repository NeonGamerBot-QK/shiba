import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import StartScreen from "@/components/StartScreen";
import MyGamesComponent from "@/components/MyGamesComponent";
import TopBar from "@/components/TopBar";

export default function MyGamesPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [disableTopBar, setDisableTopBar] = useState(false);
  const [autoOpenProfile, setAutoOpenProfile] = useState(false);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Authentication check
  useEffect(() => {
    const storedToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (storedToken) {
      setToken(storedToken);
      // Fetch profile
      const fetchProfile = async () => {
        try {
          const res = await fetch("/api/getMyProfile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: storedToken }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.ok) {
            setProfile(data.profile || null);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchProfile();
    } else {
      setToken(null);
    }
  }, []);

  const goHome = () => {
    router.push("/");
  };

  const gameData = {
    name: "My Games",
    description: "Create, update, and ship your games",
    backgroundImage: "GamesBottom.png",
    topImage: "GamesTop.png",
    bgColor: "rgba(255, 214, 224, 1)",
    gameClipAudio: "MyGames.mp3",
  };

  // Show login screen if not authenticated
  if (token === null) {
    return <StartScreen setToken={setToken} setProfile={setProfile} />;
  }

  return (
    <>
      <Head>
        <meta httpEquiv="Cross-Origin-Embedder-Policy" content="credentialless" />
        <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin" />
        <meta httpEquiv="Cross-Origin-Resource-Policy" content="cross-origin" />
      </Head>
      <div style={{ position: "relative", minHeight: "100vh" }}>
        {!disableTopBar && (
          <TopBar
            backgroundColor={gameData.bgColor}
            title={gameData.name}
            image={gameData.backgroundImage}
            onBack={goHome}
          />
        )}
        <div style={{ paddingTop: disableTopBar ? 0 : 64 }}>
          <MyGamesComponent
            disableTopBar={disableTopBar}
            setDisableTopBar={setDisableTopBar}
            goHome={goHome}
            token={token}
            SlackId={profile?.slackId || null}
            onOpenProfile={() => {
              setAutoOpenProfile(true);
              setDisableTopBar(false);
              router.push("/?openProfile=true");
            }}
            profile={profile}
          />
        </div>
      </div>
    </>
  );
}
