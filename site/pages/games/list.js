import Head from 'next/head';

export default function GamesIndexPage({ games, slackProfiles, error }) {
  if (error) {
    return (
      <>
        <Head>
          <title>Error - Global Game Gallery</title>
          <meta name="description" content="Error loading games" />
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

  if (!games) {
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

  return (
    <>
      <Head>
        <title>Global Game Gallery - Shiba Arcade</title>
        <meta name="description" content="Browse all games in the Shiba Arcade global gallery" />
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
                href="https://shiba.hackclub.com/"
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
              <span style={{ borderBottom: "1px solid #ccc" }}>Global Game Gallery</span>
            </div>
            
            <h1 style={{
              textAlign: 'center',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '2rem',
              color: '#333'
            }}>
              Shiba Game Collection
            </h1>
            
            {games.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}>
                <p>No games found with ShibaLinks.</p>
              </div>
            ) : (
              <div className="game-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2rem',
                paddingBottom: '2rem',
                maxWidth: '100%'
              }}>
                {games.map((game) => (
                  <a 
                    key={game.id} 
                    href={game.ShibaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-card"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.5rem',
                      backgroundColor: '#2a2a2a',
                      borderRadius: '12px',
                      border: '2px solid #888888',
                      textAlign: 'center',
                      textDecoration: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#3a3a3a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2a2a2a';
                    }}
                  >
                    {/* Blurred background image */}
                    {game.Thumbnail && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundImage: `url(${game.Thumbnail})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: 'blur(20px)',
                          opacity: 0.15,
                          zIndex: 0
                        }}
                      />
                    )}
                    
                    <div
                      className="game-thumbnail-disc"
                      style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '50%',
                        border: '1px solid grey',
                        background: game.Thumbnail 
                          ? `url(${game.Thumbnail})` 
                          : 'radial-gradient(circle at 40% 40%, #f0f0f0 0%, #d9d9d9 40%, #c7c7c7 70%, #bdbdbd 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        marginTop: '32px',
                        zIndex: 1,
                        boxShadow: `
                          0 0 8px rgba(255, 255, 255, 0.15),
                          0 0 15px rgba(255, 255, 255, 0.1),
                          inset 0 0 5px rgba(255, 255, 255, 0.05)
                        `,
                      }}
                    >
                      {/* Vinyl overlay for rainbow effect */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'inherit',
                          pointerEvents: 'none',
                          opacity: 0.18,
                          background: 'conic-gradient(white, white, white, grey, grey, violet, deepskyblue, aqua, palegreen, yellow, orange, red, grey, grey, white, white, white, white, grey, grey, violet, deepskyblue, aqua, palegreen, yellow, orange, red, grey, grey, white)',
                          mixBlendMode: 'screen',
                        }}
                      />
                      
                      {/* Outer ring */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: '30%',
                          height: '30%',
                          margin: '-15% 0 0 -15%',
                          borderRadius: 'inherit',
                          background: 'lightgrey',
                          backgroundClip: 'padding-box',
                          border: '4px solid rgba(0, 0, 0, 0.2)',
                          boxShadow: '0 0 1px grey',
                          boxSizing: 'border-box',
                        }}
                      />
                      
                      {/* Center hole */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: '18%',
                          height: '18%',
                          margin: '-9% 0 0 -9%',
                          borderRadius: 'inherit',
                          background: '#444444',
                          backgroundClip: 'padding-box',
                          border: '4px solid rgba(0, 0, 0, 0.1)',
                          filter: 'drop-shadow(0 0 1px grey)',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#ffffff',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      {game.Name || 'Untitled Game'}
                    </h3>
                    
                    {game['slack id'] && (() => {
                      const profile = slackProfiles[game['slack id']];
                      return (
                        <div style={{
                          position: 'absolute',
                          top: '1rem',
                          left: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#666',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(0,0,0,0.1)',
                          zIndex: 2
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
                              backgroundImage: profile?.image ? `url(${profile.image})` : 'none',
                            }}
                          />
                          <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '120px'
                          }}>{profile?.displayName || game['slack id']}</span>
                        </div>
                      );
                    })()}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .game-thumbnail-disc {
          transform: rotate(0.05deg);
          transition: transform 0.6s ease-out;
        }
        
        .game-thumbnail-disc:hover {
          transform: rotate(360.05deg);
          transition: transform 4s linear;
        }
        
        @media (max-width: 1024px) {
          .game-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1.5rem !important;
          }
        }
        
        @media (max-width: 768px) {
          .game-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }
        }
        
        @media (max-width: 480px) {
          .game-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          
          .game-card {
            padding: 1rem !important;
          }
          
          .game-thumbnail-disc {
            width: 140px !important;
            height: 140px !important;
          }
        }
      `}</style>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    // Get the host from the request
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/GetAllGames?limit=100`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }

    const games = await response.json();
    
    // Fetch Slack profiles for all unique creators
    const uniqueSlackIds = [...new Set(games.map(game => game['slack id']).filter(Boolean))];
    const slackProfiles = {};
    
    for (const slackId of uniqueSlackIds) {
      try {
        const res = await fetch(
          `https://cachet.dunkirk.sh/users/${encodeURIComponent(slackId)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (json && (json.displayName || json.image)) {
          slackProfiles[slackId] = {
            displayName: json.displayName || '',
            image: json.image || '',
          };
        }
      } catch (e) {
        console.error(e);
      }
    }

    return {
      props: {
        games,
        slackProfiles,
        error: null
      }
    };
  } catch (error) {
    console.error('Error fetching games:', error);
    return {
      props: {
        games: null,
        slackProfiles: {},
        error: error.message || 'Failed to load games'
      }
    };
  }
}
