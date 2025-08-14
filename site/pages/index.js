import { useState, useEffect } from "react";
import HomeScreen from "@/components/HomeScreen";
import StartScreen from "@/components/StartScreen";
import MyGamesComponent from "@/components/MyGamesComponent";
import GlobalGamesComponent from "@/components/GlobalGamesComponent";
import ShopComponent from "@/components/ShopComponent";
import HelpComponent from "@/components/HelpComponent";
import TopBar from "@/components/TopBar";

export default function Home() {
  

  const games = [
    {
      name: "My Games",
      description: "Create, update, and ship your games",
      image: "MyGames.png",
      bgColor: "rgba(255, 214, 224, 1)",
      gameClipAudio: "MyGames.mp3",
    },
    {
      name: "Global Games",
      description: "View global activity & playtest games",
      image: "Play.png",
      bgColor: "rgba(214, 245, 255, 1)",
      gameClipAudio: "Global.mp3"

    },
    {
      name: "Shop",
      description: "Purchase items from the shop.",
      image: "Shop.png",
      bgColor: "rgba(214, 255, 214, 1)",
      gameClipAudio: "Shop.mp3",
    },
    {
      name: "Help",
      description: "Learn how to use Shiba.",
      image: "Help.png",
      bgColor: "rgba(255, 245, 214, 1)",
      gameClipAudio: "Help.mp3",
    },
  ];


  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);

  const [appOpen, setAppOpen] = useState("Home");
  const [selectedGame, setSelectedGame] = useState(0);
  const [disableTopBar, setDisableTopBar] = useState(false);

  const goHome = () => {
    setAppOpen("Home");
  };


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
      if (!token) { setProfile(null); return; }
      try {
        const res = await fetch('/api/getMyProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (isMounted && res.ok && data?.ok) {
          setProfile(data.profile || null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [token]);

  const requestOtp = async (email) => {
    try {
      const res = await fetch("/api/newLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    return <StartScreen setToken={setToken} requestOtp={requestOtp} verifyOtp={verifyOtp} />;
  }

  if (token !== null) {
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
        />
      );
    }

    const componentsMap = {
      "My Games": MyGamesComponent,
      "Global Games": GlobalGamesComponent,
      "Shop": ShopComponent,
      "Help": HelpComponent,
    };

    const SelectedComponent = componentsMap[appOpen];
    if (SelectedComponent) {
      return (
        <div style={{ position: "relative", minHeight: "100vh" }}>
          {!disableTopBar && (
            <TopBar
            backgroundColor={games[selectedGame].bgColor}
              title={games[selectedGame].name}
              image={games[selectedGame].image}
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
            />
          </div>
        </div>
      );
    }
  }
}