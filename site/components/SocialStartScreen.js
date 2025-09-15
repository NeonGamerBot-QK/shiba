import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });

export default function SocialStartScreen() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [displayCount, setDisplayCount] = useState(12);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  // Fetch posts using the new preload API
  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        setPostsLoading(true);
        setPostsError('');
        const res = await fetch('/api/GetAllPostsPreload?limit=100');
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          const normalized = Array.isArray(data)
            ? data.map((p) => ({
                createdAt: p['Created At'] || p.createdAt || '',
                PlayLink: typeof p.PlayLink === 'string' ? p.PlayLink : '',
                attachments: Array.isArray(p.Attachements) ? p.Attachements : [],
                slackId: p['slack id'] || '',
                gameName: p['Game Name'] || '',
                content: p.Content || '',
                postId: p.PostID || '',
                gameThumbnail: p.GameThumbnail || '',
                badges: Array.isArray(p.Badges) ? p.Badges : [],
                postType: p.postType || 'devlog',
                timelapseVideoId: p.timelapseVideoId || '',
                githubImageLink: p.githubImageLink || '',
                timeScreenshotId: p.timeScreenshotId || '',
                hoursSpent: p.hoursSpent || 0,
                minutesSpent: p.minutesSpent || 0,
                timeSpentOnAsset: p.timeSpentOnAsset || 0,
                posterShomatoSeeds: p.posterShomatoSeeds || 0,
              }))
            : [];
          setPosts(normalized);
          setHasMore(normalized.length >= 12);
        }
      } catch (e) {
        if (!cancelled) setPostsError('Failed to load posts');
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    };
    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = () => {
    const newCount = displayCount + 12;
    setDisplayCount(newCount);
    setHasMore(newCount < posts.length);
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        width: "100vw",
        minHeight: "100vh",
        minWidth: "100vw",
        fontSize: "19.2px",
      }}
    >
      <div
        style={{
          width: "100vw",
          minHeight: "100vh",
          minWidth: "100vw",
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "white",
        }}
      >
        {/* Top Bar - Absolutely Positioned */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: "white",
          padding: "16px 20px",
          borderBottom: "1px solid #e0e0e0"
        }}>
          <div style={{width: "100%", display: "flex", maxWidth: "1000px", margin: "0 auto"}}>
            <div style={{display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%"}}>
              <h1
                style={{
                  color: "black",
                  fontSize: "24px",
                  fontWeight: "bold",
                  margin: 0,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Shiba Arcade
              </h1>
              <p style={{
                textAlign: "center", 
                margin: 0,
                fontSize: "16px",
                color: "black",
                flex: 1,
                padding: "0 20px"
              }}>
                build games, get feedback, & form friendships
              </p>
              <div style={{display: "flex", flexDirection: "row", alignItems: "center", gap: "16px", flexShrink: 0}}>
                <button style={{
                  padding: "8px 16px",
                  border: "1px solid #D47A2D",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  color: "#D47A2D",
                  cursor: "pointer",
                  fontSize: "14px"
                }}>
                  Signup
                </button>
                <button style={{
                  padding: "8px 16px",
                  border: "1px solid #000",
                  borderRadius: "4px",
                  backgroundColor: "#F5994B",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "14px"
                }}>
                  Login
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with padding to offset top bar */}
        <div
          style={{
            minHeight: "100vh",
            minWidth: "100vw",
            padding: "100px 8vw 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            width: "100%",
            overflow: "visible",
          }}
        >
          <div style={{
            width: "100%",
            maxWidth: "1000px",
          }}>
            <p style={{
              color: "black",
              fontSize: "16px",
              margin: 0,
              textAlign: "left",
              marginBottom: "20px"
            }}>
              Trending Games this Week
            </p>

            {/* Posts Display */}
            {postsLoading ? (
              <p style={{ color: "black", textAlign: "center", marginTop: "20px" }}>
                Loading posts...
              </p>
            ) : postsError ? (
              <p style={{ color: "red", textAlign: "center", marginTop: "20px" }}>
                {postsError}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                  marginTop: "20px",
                  width: "100%",
                }}
              >
                {posts.slice(0, displayCount).map((p, idx) => (
                  <div
                    key={p.postId || idx}
                    style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: "10px",
                      background: "white",
                      padding: "12px",
                      position: "relative",
                      width: "100%",
                      minWidth: 0,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ 
                      width: "100%", 
                      minWidth: 0, 
                      overflow: "hidden",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column"
                    }}>
                      <PostAttachmentRenderer
                        content={p.content}
                        attachments={p.attachments}
                        playLink={p.PlayLink}
                        gameName={p.gameName}
                        thumbnailUrl={p.gameThumbnail || ''}
                        slackId={p.slackId}
                        createdAt={p.createdAt}
                        token={null}
                        badges={p.badges}
                        gamePageUrl={`https://shiba.hackclub.com/games/${p.slackId}/${encodeURIComponent(p.gameName || '')}`}
                        onPlayCreated={(play) => {
                          console.log('Play created:', play);
                        }}
                        postType={p.postType}
                        timelapseVideoId={p.timelapseVideoId}
                        githubImageLink={p.githubImageLink}
                        timeScreenshotId={p.timeScreenshotId}
                        hoursSpent={p.hoursSpent}
                        timeSpentOnAsset={p.timeSpentOnAsset}
                        minutesSpent={p.minutesSpent}
                        postId={p.postId}
                        compact={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Load More Button */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button
                  onClick={loadMore}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#F5994B",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
