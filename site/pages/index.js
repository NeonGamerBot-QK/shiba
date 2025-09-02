import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import HomeScreen from "@/components/HomeScreen";
import StartScreen from "@/components/StartScreen";
import MyGamesComponent from "@/components/MyGamesComponent";
import GlobalGamesComponent from "@/components/GlobalGamesComponent";
import ShopComponent from "@/components/ShopComponent";
import HelpComponent from "@/components/HelpComponent";
import TopBar from "@/components/TopBar";
import PlaytestMode from "@/components/PlaytestMode";
import useAudioManager from "@/components/useAudioManager";

export default function Home() {
  const router = useRouter();
  const games = [
    {
      name: "My Games",
      description: "Create, update, and ship your games",
      backgroundImage: "GamesBottom.png",
      topImage: "GamesTop.png",
      bgColor: "rgba(255, 214, 224, 1)",
      gameClipAudio: "MyGames.mp3",
    },
    {
      name: "Global Games",
      description: "View global activity & playtest games",
      backgroundImage: "PlayBottom.png",
      topImage: "PlayTop.png",
      bgColor: "rgba(214, 245, 255, 1)",
      gameClipAudio: "Global.mp3",
    },
    {
      name: "Shop",
      description: "Purchase items from the shop.",
      backgroundImage: "ShopBottom.png",
      topImage: "ShopTop.png",
      bgColor: "rgba(214, 255, 214, 1)",
      gameClipAudio: "Shop.mp3",
    },
    {
      name: "Help",
      description: "Learn how to use Shiba.",
      backgroundImage: "HelpBottom.png",
      topImage: "HelpTop.png",
      bgColor: "rgba(255, 245, 214, 1)",
      gameClipAudio: "Help.mp3",
    },
  ];

  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);

  const [appOpen, setAppOpen] = useState("Home");
  const [selectedGame, setSelectedGame] = useState(0);
  const [disableTopBar, setDisableTopBar] = useState(false);
  const [autoOpenProfile, setAutoOpenProfile] = useState(false);
  const [playtestMode, setPlaytestMode] = useState(false);
  const [selectedPlaytestGame, setSelectedPlaytestGame] = useState(null);

  // Audio manager for sound effects
  const { play: playSound, stopAll } = useAudioManager(["next.mp3", "prev.mp3", "Dream.mp3"]);

  const goHome = () => {
    setAppOpen("Home");
  };

  // Handle URL token parameter - only once on mount
  useEffect(() => {
    if (router.isReady) {
      const { token: urlToken } = router.query;
      if (urlToken) {
        localStorage.setItem("token", urlToken);
        setToken(urlToken);
      }
    }
  }, [router.isReady]); // Only run when router becomes ready

  // Handle other URL query parameters
  useEffect(() => {
    if (router.isReady) {
      const { openProfile } = router.query;
      
      if (openProfile === "true") {
        setAutoOpenProfile(true);
        // Clean up the URL without triggering a page reload
        router.replace("/", undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query]);

  // Reset autoOpenProfile after it's been used
  useEffect(() => {
    if (autoOpenProfile && appOpen === "Home") {
      // Reset the flag after a short delay to ensure HomeScreen has processed it
      const timer = setTimeout(() => {
        setAutoOpenProfile(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoOpenProfile, appOpen]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Fetch profile when token is available
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (!token) {
        setProfile(null);
        return;
      }
      try {
        const res = await fetch("/api/getMyProfile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (isMounted) {
          if (res.ok && data?.ok) {
            setProfile(data.profile || null);
          } else if (res.status === 401) {
            // Token is invalid, log user out
            localStorage.removeItem("token");
            setToken(null);
            setProfile(null);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        // On network error, also log out to be safe
        if (isMounted) {
          localStorage.removeItem("token");
          setToken(null);
          setProfile(null);
        }
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const requestOtp = async (email, sentby) => {
    try {
      const res = await fetch("/api/newLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sentby }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, ...data };
    } catch (e) {
      return { ok: false, message: "Network error" };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const res = await fetch("/api/tryOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.token) {
        localStorage.setItem("token", data.token);
      }
      return { ok: res.ok, ...data };
    } catch (e) {
      return { ok: false, message: "Network error" };
    }
  };

  if (token === null) {
    return (
      <StartScreen
        setToken={setToken}
        requestOtp={requestOtp}
        verifyOtp={verifyOtp}
      />
    );
  }

  if (token !== null) {
    // Render playtest mode if active
    if (playtestMode) {
      return (
        <PlaytestMode 
          onExit={() => {
            setPlaytestMode(false);
            setSelectedPlaytestGame(null);
          }}
          profile={profile}
          playtestGame={selectedPlaytestGame}
          playSound={playSound}
          stopAll={stopAll}
          token={token}
        />
      );
    }

  }

  return (
    <>
      <Head>
        <title>Shiba Arcade</title>
        <meta name="description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://shiba.hackclub.com" />
        <meta property="og:title" content="Shiba Arcade" />
        <meta property="og:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="og:image" content="https://shiba.hackclub.com/bg.gif" />
        <meta property="og:image:type" content="image/gif" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://shiba.hackclub.com" />
        <meta property="twitter:title" content="Shiba Arcade" />
        <meta property="twitter:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="twitter:image" content="https://shiba.hackclub.com/bg.gif" />
      </Head>
      {(() => {
        if (appOpen === "Home") {
          return (
            <HomeScreen
              games={games}
              appOpen={appOpen}
              setAppOpen={setAppOpen}
              selectedGame={selectedGame}
              setSelectedGame={setSelectedGame}
              SlackId={profile?.slackId || null}
              token={token}
              profile={profile}
              setProfile={setProfile}
              autoOpenProfile={autoOpenProfile}
            />
          );
        }

        const componentsMap = {
          "My Games": MyGamesComponent,
          "Global Games": GlobalGamesComponent,
          Shop: ShopComponent,
          Help: HelpComponent,
        };

        const SelectedComponent = componentsMap[appOpen];
        if (SelectedComponent) {
          return (
            <div style={{ position: "relative", minHeight: "100vh" }}>
              {!disableTopBar && (
                <TopBar
                  backgroundColor={games[selectedGame].bgColor}
                  title={games[selectedGame].name}
                  image={games[selectedGame].backgroundImage}
                  onBack={() => setAppOpen("Home")}
                />
              )}
              <div style={{ paddingTop: disableTopBar ? 0 : 64 }}>
                <SelectedComponent
                  disableTopBar={disableTopBar}
                  setDisableTopBar={setDisableTopBar}
                  goHome={goHome}
                  token={token}
                  SlackId={profile?.slackId || null}
                  profile={profile}
                  setProfile={setProfile}
                  setPlaytestMode={setPlaytestMode}
                  setSelectedPlaytestGame={setSelectedPlaytestGame}
                  onOpenProfile={appOpen === "My Games" ? () => {
                    setAutoOpenProfile(true);
                    setDisableTopBar(false);
                    setAppOpen("Home");
                  } : undefined}
                />
              </div>
            </div>
          );
        }
      })()}
    </>
  );
}
