import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Simple in-memory cache for games data
let gamesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 900000; // 15 minutes in milliseconds

const PlayGameComponent = dynamic(() => import('@/components/utils/playGameComponent.js'), { ssr: false });
const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });

// Function to get cached games data
async function getCachedGamesData() {
  const now = Date.now();
  
  // Check if cache is still valid
  if (gamesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('Using cached games data');
    return gamesCache;
  }
  
  // Fetch fresh data
  console.log('Fetching fresh games data from API');
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shiba.hackclub.com' 
    : 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/GetAllGames?full=true&limit=50`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch games data: ${response.status}`);
  }
  
  const games = await response.json();
  
  // Update cache
  gamesCache = games;
  cacheTimestamp = now;
  
  console.log(`Cached ${games.length} games`);
  return games;
}

export default function GamesPage({ gameData, error }) {
  const router = useRouter();
  const { user, id } = router.query;
  const [loading, setLoading] = useState(false);
  const [slackProfile, setSlackProfile] = useState(null);
  const [selectedView, setSelectedView] = useState('Devlogs'); // 'Devlogs' | 'Artlogs' | 'Plays'
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  // Fetch Slack displayName and image via cachet
  useEffect(() => {
    let cancelled = false;
    const fetchSlack = async () => {
      if (!user) return;
      try {
        const res = await fetch(
          `https://cachet.dunkirk.sh/users/${encodeURIComponent(user)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json && (json.displayName || json.image)) {
          setSlackProfile({
            displayName: json.displayName || '',
            image: json.image || '',
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSlack();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (error) {
    return (
      <>
        <Head>
          <title>Game Not Found - Shiba Arcade</title>
          <meta name="description" content="The requested game could not be found." />
        </Head>
        <div style={{
          width: '100%', 
          alignItems: "center", 
          height: '100%', 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'linear-gradient(180deg, #f8f9fa 0px, #f1f3f4 100px, #e8eaed 200px, #f8f9fa 300px, #fff 400px, #fff 100%)',
          justifyContent: 'center'
        }}>
          <p>Error: {error}</p>
        </div>
      </>
    );
  }

  if (!gameData) {
    return (
      <>
        <Head>
          <title>Loading Game - Shiba Arcade</title>
          <meta name="description" content="Loading game details..." />
        </Head>
        <div style={{
          width: '100%', 
          alignItems: "center", 
          height: '100%', 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'linear-gradient(180deg, #f8f9fa 0px, #f1f3f4 100px, #e8eaed 200px, #f8f9fa 300px, #fff 400px, #fff 100%)',
          justifyContent: 'center'
        }}>
          <p>Loading...</p>
        </div>
      </>
    );
  }

  // Generate meta tags based on game data
  const gameTitle = gameData?.name || id;
  const gameDescription = gameData?.description || `Play ${gameTitle} on Shiba Arcade`;
  const gameImage = gameData?.thumbnailUrl || 'https://shiba.hackclub.com/shiba.png';
  const pageTitle = `${gameTitle} - Shiba Arcade`;
  const pageDescription = gameDescription.length > 160 ? gameDescription.substring(0, 157) + '...' : gameDescription;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(id)}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={gameImage} />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(id)}`} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        <meta property="twitter:image" content={gameImage} />
      </Head>
      <div style={{
        width: '100%', 
        alignItems: "center", 
        height: '100%', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'linear-gradient(180deg, #f8f9fa 0px, #f1f3f4 100px, #e8eaed 200px, #f8f9fa 300px, #fff 400px, #fff 100%)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/comicbg.jpg)',
          backgroundSize: '100%',
          imageRendering: 'pixelated',
          backgroundRepeat: 'repeat',
          mixBlendMode: 'multiply',
          opacity: 0.1,
          pointerEvents: 'none',
          zIndex: 1
        }} />
                <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{width: "100%", maxWidth: 800}}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              marginTop: 16,
              marginLeft: "auto",
              marginRight: "auto",
              padding: "6px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "8px",
              border: "1px solid #666",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              flexWrap: "wrap",
              gap: "8px",
              width: "fit-content",
              fontSize: "14px"
            }}>
              <a 
                href="https://shiba.hackclub.com/games/list"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  borderBottom: "1px solid #ccc"
                }}
              >
                <span>Shiba Games</span>
              </a>
              <span style={{ color: "#666" }}>/</span>
              <a 
                href={`https://hackclub.slack.com/team/${user}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.18)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: '#fff',
                      backgroundImage: slackProfile?.image ? `url(${slackProfile.image})` : 'none',
                    }}
                  />
                  <span style={{ borderBottom: "1px solid #ccc" }}>{slackProfile?.displayName || user}</span>
                </div>
              </a>
              <span style={{ color: "#666" }}>/</span>
              <a 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.reload();
                }}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  borderBottom: "1px solid #ccc"
                }}
              >
                <span>{gameData?.name || 'Game Name'}</span>
              </a>
            </div>
            <div style={{ 
              width: '100%', 
              maxWidth: '1152px',
              border: "3px solid #fff",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              overflow: "hidden"
            }}>
            {gameData?.playableURL && (() => {
              let gameId = '';
              try {
                // Handle both string and array formats
                const playableURL = Array.isArray(gameData.playableURL) ? gameData.playableURL[0] : gameData.playableURL;
                if (!playableURL) return null;
                
                const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
                const m = /\/play\/([^\/?#]+)/.exec(path);
                gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
              } catch (_) {
                gameId = '';
              }
              return gameId ? (
                <PlayGameComponent 
                  gameId={gameId}
                  gameName={gameData?.name || id}
                  thumbnailUrl={gameData?.thumbnailUrl || ''}
                  width="100%"
                  gamePageUrl={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(gameData?.name || id)}`}
                />
              ) : (
                <div style={{ aspectRatio: '16 / 9', border: "1px solid #000", width: '100%', maxWidth: '1152px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  No playable URL available
                </div>
              );
            })()}
          </div>
          {gameData?.description && (
            <p style={{marginTop: 16, marginBottom: 8}}>{gameData.description}</p>
          )}

          {/* View Selector */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 16,
            marginBottom: 16,
            marginLeft: "auto",
            marginRight: "auto",
            padding: "4px 6px",
            backgroundColor: "#fff",
            width: "fit-content",
            gap: "8px",
            borderRadius: "12px",
            border: "1px solid #ccc"
          }}>
            <button
              onClick={() => setSelectedView("Devlogs")}
              style={{
                appearance: "none",
                border: selectedView === "Devlogs" ? "2px solid #000" : "1px solid #ccc",
                background: selectedView === "Devlogs" ? "#000" : "#fff",
                color: selectedView === "Devlogs" ? "#fff" : "#000",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "14px",
                transition: "all 0.2s ease"
              }}
            >
              Devlogs
              {Array.isArray(gameData?.posts) && gameData.posts.length > 0 && (() => {
                const devlogPosts = gameData.posts.filter(post => post.postType !== 'artlog');
                const totalHours = devlogPosts.reduce((sum, post) => sum + (post.HoursSpent || 0), 0);
                return totalHours > 0 ? (
                  <span style={{ marginLeft: "6px", opacity: 0.8 }}>
                    ({totalHours.toFixed(2)} hours)
                  </span>
                ) : null;
              })()}
            </button>
            
            <button
              onClick={() => setSelectedView("Artlogs")}
              style={{
                appearance: "none",
                border: selectedView === "Artlogs" ? "2px solid #000" : "1px solid #ccc",
                background: selectedView === "Artlogs" ? "#000" : "#fff",
                color: selectedView === "Artlogs" ? "#fff" : "#000",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "14px",
                transition: "all 0.2s ease"
              }}
            >
              Artlogs
              {Array.isArray(gameData?.posts) && gameData.posts.length > 0 && (() => {
                const artlogPosts = gameData.posts.filter(post => post.postType === 'artlog');
                const totalHours = artlogPosts.reduce((sum, post) => sum + (post.timeSpentOnAsset || 0), 0);
                return totalHours > 0 ? (
                  <span style={{ marginLeft: "6px", opacity: 0.8 }}>
                    ({totalHours.toFixed(2)} hours)
                  </span>
                ) : null;
              })()}
            </button>
            
            <button
              onClick={() => setSelectedView("Plays")}
              style={{
                appearance: "none",
                border: selectedView === "Plays" ? "2px solid #000" : "1px solid #ccc",
                background: selectedView === "Plays" ? "#000" : "#fff",
                color: selectedView === "Plays" ? "#fff" : "#000",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "14px",
                transition: "all 0.2s ease"
              }}
            >
              Plays
              <span style={{ marginLeft: "6px", opacity: 0.8 }}>
                ({gameData?.playsCount || 0})
              </span>
            </button>
          </div>

          {/* Devlogs View */}
          {selectedView === "Devlogs" && (
            <>
              {Array.isArray(gameData?.posts) && gameData.posts.length > 0 ? (() => {
                const devlogPosts = gameData.posts.filter(post => post.postType !== 'artlog');
                return devlogPosts.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: "32px" }}>
                    {devlogPosts.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="moment-card" style={{ 
                      position: "relative",
                      border: "1px solid rgba(0, 0, 0, 0.18)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.8)",
                      padding: "12px"
                    }}>
                      <PostAttachmentRenderer
                        content={p.content}
                        attachments={p.attachments}
                        playLink={p.PlayLink}
                        gameName={gameData?.name || ""}
                        thumbnailUrl={gameData?.thumbnailUrl || ""}
                        token={null}
                        slackId={user}
                        createdAt={p.createdAt}
                        badges={p.badges}
                        HoursSpent={p.HoursSpent}
                        gamePageUrl={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(gameData?.name || id)}`}
                        onPlayCreated={(play) => {
                          console.log("Play created:", play);
                        }}
                        postType={p.postType}
                        timelapseVideoId={p.timelapseVideoId}
                        githubImageLink={p.githubImageLink}
                        timeScreenshotId={p.timeScreenshotId}
                        hoursSpent={p.hoursSpent || p.HoursSpent || 0}
                        timeSpentOnAsset={p.timeSpentOnAsset || 0}
                        minutesSpent={p.minutesSpent}
                        postId={p.PostID}
                        currentUserProfile={null}
                        onTimeUpdated={() => {}} // No-op for public pages
                      />
                    </div>
                    ))}
                  </div>
                ) : (
                  <div style={{width: "100%", border: "1px solid #000", padding: 16}}>
                    <p>No devlog posts yet</p>
                  </div>
                );
              })() : (
                <div style={{width: "100%", border: "1px solid #000", padding: 16}}>
                  <p>No posts yet</p>
                </div>
              )}
            </>
          )}

          {/* Artlogs View */}
          {selectedView === "Artlogs" && (
            <>
              {Array.isArray(gameData?.posts) && gameData.posts.length > 0 ? (() => {
                const artlogPosts = gameData.posts.filter(post => post.postType === 'artlog');
                return artlogPosts.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: "32px" }}>
                    {artlogPosts.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="moment-card" style={{ 
                      position: "relative",
                      border: "1px solid rgba(0, 0, 0, 0.18)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.8)",
                      padding: "12px"
                    }}>
                      <PostAttachmentRenderer
                        content={p.content}
                        attachments={p.attachments}
                        playLink={p.PlayLink}
                        gameName={gameData?.name || ""}
                        thumbnailUrl={gameData?.thumbnailUrl || ""}
                        token={null}
                        slackId={user}
                        createdAt={p.createdAt}
                        badges={p.badges}
                        HoursSpent={p.HoursSpent}
                        gamePageUrl={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(gameData?.name || id)}`}
                        onPlayCreated={(play) => {
                          console.log("Play created:", play);
                        }}
                        postType={p.postType}
                        timelapseVideoId={p.timelapseVideoId}
                        githubImageLink={p.githubImageLink}
                        timeScreenshotId={p.timeScreenshotId}
                        hoursSpent={p.hoursSpent || p.HoursSpent || 0}
                        timeSpentOnAsset={p.timeSpentOnAsset || 0}
                        minutesSpent={p.minutesSpent}
                        postId={p.PostID}
                        currentUserProfile={null}
                        onTimeUpdated={() => {}} // No-op for public pages
                      />
                    </div>
                    ))}
                  </div>
                ) : (
                  <div style={{width: "100%", border: "1px solid #000", padding: 16}}>
                    <p>No artlog posts yet</p>
                  </div>
                );
              })() : (
                <div style={{width: "100%", border: "1px solid #000", padding: 16}}>
                  <p>No posts yet</p>
                </div>
              )}
            </>
          )}

          {/* Plays View */}
          {selectedView === "Plays" && (
            <>
              {Array.isArray(gameData?.plays) && gameData.plays.length > 0 ? (
                <div style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  border: "1px solid #666",
                  padding: "8px",
                  marginTop: "16px"
                }}>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", 
                    gap: "8px"
                  }}>
                    {gameData.plays.map((player, idx) => {
                      const isHovered = hoveredPlayer === player.slackId;
                      return (
                        <a
                          key={player.slackId || idx}
                          href={`https://hackclub.slack.com/team/${player.slackId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "block",
                            textDecoration: "none",
                            color: "inherit",
                            transition: "transform 0.3s ease"
                          }}
                          onMouseEnter={() => setHoveredPlayer(player.slackId)}
                          onMouseLeave={() => setHoveredPlayer(null)}
                        >
                          <div style={{
                            width: "40px",
                            height: "40px",
                            border: isHovered ? "1px solid #000" : "1px solid #ccc",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundColor: "#f0f0f0",
                            backgroundImage: player.image ? `url(${player.image})` : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            fontWeight: "600",
                            color: "#666",
                            overflow: "hidden",
                            transform: isHovered ? "scale(1.1)" : "scale(1)",
                            transition: "transform 0.3s ease, border-color 0.3s ease"
                          }}>
                            {!player.image && (
                              <span>{player.displayName ? player.displayName.charAt(0).toUpperCase() : "?"}</span>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  border: "1px solid #666",
                  padding: "16px",
                  marginTop: "16px"
                }}>
                  <p>No plays yet</p>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticPaths() {
  try {
    const games = await getCachedGamesData();
    
    // Generate paths for ALL games with full data
    const paths = games
      .filter((game) => {
        return game && 
               game.slackId && 
               typeof game.slackId === 'string' && 
               game.name && 
               typeof game.name === 'string' &&
               game.slackId.trim().length > 0 &&
               game.name.trim().length > 0;
      })
      .map((game) => ({
        params: {
          user: game.slackId.trim(),
          id: game.name.trim()
        }
      }));

    console.log(`Pre-generated ${paths.length} static paths for games`);
    return {
      paths,
      fallback: false // Don't generate on-demand since we pre-generated all paths
    };
  } catch (error) {
    console.error('Error generating static paths:', error);
    console.log('Falling back to empty paths - pages will be generated on-demand');
    return {
      paths: [],
      fallback: 'blocking'
    };
  }
}

export async function getStaticProps(context) {
  const { user, id } = context.params;

  try {
    const games = await getCachedGamesData();
    
    // Find the specific game by user and id
    const gameData = games.find(game => 
      game.slackId === user && 
      game.name === id
    );

    if (!gameData) {
      console.error(`Game not found: ${user}/${id}`);
      return {
        props: {
          gameData: null,
          error: 'Game not found'
        },
        revalidate: 900
      };
    }

    // Format the last updated date on the server to avoid hydration issues
    if (gameData && gameData.lastUpdated) {
      gameData.lastUpdatedFormatted = new Date(gameData.lastUpdated).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      });
    }

    console.log(`Found game data for ${user}/${id}:`, gameData.name);

    return {
      props: {
        gameData,
        error: null
      },
      revalidate: 3600
    };
  } catch (error) {
    console.error('Error fetching game data:', error);
    return {
      props: {
        gameData: null,
        error: 'Failed to load game data'
      },
      revalidate: 3600
    };
  }
}
