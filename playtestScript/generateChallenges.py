import os
from dotenv import load_dotenv
import requests
import openai

# Load environment variables from .env file
load_dotenv()

# Environment Variables
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")
OPENAI_API_KEY = os.getenv("OPENAI")

# Initialize OpenAI client
openai.api_key = OPENAI_API_KEY

# Airtable configuration
AIRTABLE_API_BASE = 'https://api.airtable.com/v0'
PLAYTEST_TICKETS_TABLE = 'PlaytestTickets'
CHALLENGES_TABLE = 'Challenges'

def airtable_request(path, options=None):
    """Make a request to the Airtable API"""
    if options is None:
        options = {}
    
    url = f"{AIRTABLE_API_BASE}/{AIRTABLE_BASE_ID}/{path}"
    
    headers = {
        'Authorization': f'Bearer {AIRTABLE_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Add any additional headers from options
    if 'headers' in options:
        headers.update(options['headers'])
    
    response = requests.request(
        method=options.get('method', 'GET'),
        url=url,
        headers=headers,
        json=options.get('json'),
        params=options.get('params')
    )
    
    if not response.ok:
        raise Exception(f"Airtable error {response.status_code}: {response.text}")
    
    return response.json()

def fetch_all_playtests():
    """Fetch all records from the PlaytestTickets table"""
    all_records = []
    offset = None
    
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            page = airtable_request(f"{PLAYTEST_TICKETS_TABLE}?{requests.compat.urlencode(params)}", {
                'method': 'GET'
            })
            
            page_records = page.get('records', [])
            all_records.extend(page_records)
            offset = page.get('offset')
            
            if not offset:
                break
                
        except Exception as e:
            print(f"Error fetching playtest records: {e}")
            break
    
    return all_records

def generate_challenge_from_feedback(feedback, game_name, scores, existing_challenges=None):
    """Generate a specific challenge from playtest feedback using OpenAI"""
    if not feedback or not feedback.strip():
        return "No challenge found"
    
    # Prepare existing challenges context
    existing_context = ""
    if existing_challenges:
        existing_context = f"\n\nEXISTING CHALLENGES FOR THIS GAME (make sure your challenge is different):\n"
        for i, challenge in enumerate(existing_challenges, 1):
            existing_context += f"{i}. {challenge}\n"
    
    # Prepare the prompt
    prompt = f"""
You are a game development mentor. Based on the following playtest feedback, generate ONE specific, actionable challenge that the game developer can implement to improve their game.

Game: {game_name}
Scores: Fun={scores.get('fun_score', 'N/A')}, Art={scores.get('art_score', 'N/A')}, Creativity={scores.get('creativity_score', 'N/A')}, Audio={scores.get('audio_score', 'N/A')}, Mood={scores.get('mood_score', 'N/A')}

Feedback:
{feedback}{existing_context}

Instructions:
- Generate ONE specific, measurable, testable challenge that is achievable within 2 hours (but don't mention the time constraint in your response)
- Start directly with the action (e.g., "Add...", "Implement...", "Fix...", "Create...")
- Be concise and direct - no explanations or context
- The challenge must be something concrete the developer can implement AND easily verify completion
- Make it specific with clear success criteria and realistic scope (e.g., "Add 3 visual cues", "Fix 2 audio bugs", "Add 1 new enemy type", "Create 1 new level")
- Avoid vague concepts like "improve gameplay", "enhance creativity", "make it more fun" - focus on concrete features
- If the feedback is too vague or doesn't contain actionable suggestions, respond with "No challenge found"
- Keep it under 20 words
- Make it something that directly addresses the feedback given
- IMPORTANT: Make sure your challenge is different from any existing challenges listed above
- CRITICAL: The challenge must be measurable/testable and achievable within 2 hours - someone should be able to clearly determine if it's completed
- DO NOT include time constraints like "within 2 hours" or "in 2 hours" in your final challenge response

Challenge:"""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful game development mentor who creates specific, actionable challenges from playtest feedback."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        challenge = response.choices[0].message.content.strip()
        
        # If the response is too generic or indicates no challenge, return "No challenge found"
        if (challenge.lower().startswith("no challenge") or 
            challenge.lower().startswith("no specific") or
            len(challenge) < 20 or
            "no challenge found" in challenge.lower()):
            return "No challenge found"
            
        return challenge
        
    except Exception as e:
        print(f"Error generating challenge: {e}")
        return "No challenge found"

def calculate_sss_earnable(sss_awarded):
    """Calculate how much SSS can still be earned (up to 25 - current SSS)"""
    try:
        current_sss = int(sss_awarded) if sss_awarded else 0
        max_sss = 25
        sss_earnable = max(0, max_sss - current_sss)
        return sss_earnable
    except (ValueError, TypeError):
        return 0

def create_challenge_record(challenge_data):
    """Create a record in the 'Challenges' Airtable table"""
    print(f"📝 Creating challenge record in '{CHALLENGES_TABLE}' table...")
    try:
        response = airtable_request(CHALLENGES_TABLE, {
            'method': 'POST',
            'json': {'fields': challenge_data}
        })
        if response and response.get('id'):
            print(f"✅ Challenge record created: {response['id']}")
            return response['id']
        else:
            print(f"❌ Failed to create challenge record: {response}")
            return None
    except Exception as e:
        print(f"🚨 Error creating challenge record: {e}")
        return None

def get_schema():
    """Get the schema for the PlaytestTickets table"""
    print("🔍 Fetching PlaytestTickets Table Schema")
    print("=" * 60)
    
    try:
        # Get a single record to see the field structure
        response = airtable_request(f"{PLAYTEST_TICKETS_TABLE}?maxRecords=1", {
            'method': 'GET'
        })
        
        records = response.get('records', [])
        if records:
            fields = records[0].get('fields', {})
            print("📋 Available Fields in PlaytestTickets table:")
            for field_name, field_value in fields.items():
                print(f"  {field_name}: {field_value} (type: {type(field_value).__name__})")
        else:
            print("No records found in PlaytestTickets table")
            
        return fields if records else {}
        
    except Exception as e:
        print(f"Error fetching schema: {e}")
        return {}

def get_complete_playtests(show_details=False):
    """Get all playtests with status 'Complete' and their content for feedback"""
    print("\n🎯 Fetching Complete Playtests for Challenge Generation")
    print("=" * 60)
    
    # Fetch all playtest records
    all_playtests = fetch_all_playtests()
    
    print(f"📊 Total playtests found: {len(all_playtests)}")
    
    # Filter for complete playtests
    complete_playtests = []
    for record in all_playtests:
        fields = record.get('fields', {})
        status = fields.get('status', '')
        
        if status == 'Complete':
            # Check if this playtest already has challenges
            existing_challenges = fields.get('Challenges', [])
            has_existing_challenges = existing_challenges and len(existing_challenges) > 0
            
            complete_playtests.append({
                'record_id': record.get('id'),
                'playtest_id': fields.get('PlaytestId', 'Unknown'),
                'game_to_test': fields.get('GameToTest', []),
                'player': fields.get('Player', []),
                'status': status,
                'feedback': fields.get('Feedback', ''),
                'fun_score': fields.get('Fun Score', ''),
                'art_score': fields.get('Art Score', ''),
                'creativity_score': fields.get('Creativity Score', ''),
                'audio_score': fields.get('Audio Score', ''),
                'mood_score': fields.get('Mood Score', ''),
                'sss_awarded': fields.get('SSSAwarded', ''),
                'playtime_seconds': fields.get('Playtime Seconds', ''),
                'created_time': fields.get('Created At', ''),
                'game_name': fields.get('Game Name', []),
                'player_email': fields.get('PlayerEmail', []),
                'owner_email': fields.get('ownerEmail', []),
                'has_existing_challenges': has_existing_challenges,
                'all_fields': fields  # Include all fields for comprehensive view
            })
    
    print(f"📊 Found {len(complete_playtests)} complete playtests")
    
    # Only show detailed information if requested
    if show_details:
        print()
        for i, playtest in enumerate(complete_playtests, 1):
            print(f"🎮 Playtest #{i}")
            print("-" * 40)
            print(f"Record ID: {playtest['record_id']}")
            print(f"Playtest ID: {playtest['playtest_id']}")
            print(f"Status: {playtest['status']}")
            print(f"Game to Test: {playtest['game_to_test']}")
            print(f"Game Name: {playtest['game_name']}")
            print(f"Player: {playtest['player']}")
            print(f"Player Email: {playtest['player_email']}")
            print(f"Owner Email: {playtest['owner_email']}")
            print(f"Fun Score: {playtest['fun_score']}")
            print(f"Art Score: {playtest['art_score']}")
            print(f"Creativity Score: {playtest['creativity_score']}")
            print(f"Audio Score: {playtest['audio_score']}")
            print(f"Mood Score: {playtest['mood_score']}")
            print(f"SSS Awarded: {playtest['sss_awarded']}")
            print(f"Playtime: {playtest['playtime_seconds']} seconds")
            print(f"Created: {playtest['created_time']}")
            print(f"Feedback: {playtest['feedback']}")
            print()
            print("=" * 60)
            print()
    
    return complete_playtests

def main():
    """Main function to get complete playtests and their feedback content"""
    print("🚀 Generate Challenges - Complete Playtests Analysis")
    print("=" * 60)
    
    # Ask for user preference
    print("Choose an option:")
    print("1. Show summary only (quick overview)")
    print("2. Show detailed playtest data (full feedback content)")
    print("3. Generate challenges from feedback (using OpenAI)")
    response = input("Enter your choice (1, 2, or 3): ")
    
    show_details = response.strip() == '2'
    generate_challenges = response.strip() == '3'
    
    if show_details:
        print("📋 Running detailed analysis - this may take a moment...")
    elif generate_challenges:
        print("🤖 Generating challenges from feedback using OpenAI...")
    else:
        print("📊 Running summary analysis...")
    
    try:
        complete_playtests = get_complete_playtests(show_details=show_details)
        
        # Generate challenges if requested
        if generate_challenges and complete_playtests:
            print(f"\n🎯 Generating challenges for {len(complete_playtests)} playtests...")
            print("=" * 60)
            
            # Filter out playtests that already have challenges
            playtests_without_challenges = [p for p in complete_playtests if not p['has_existing_challenges']]
            playtests_with_challenges = [p for p in complete_playtests if p['has_existing_challenges']]
            
            print(f"📊 Playtests already with challenges: {len(playtests_with_challenges)}")
            print(f"📊 Playtests needing challenges: {len(playtests_without_challenges)}")
            
            # Group playtests by game (only those without challenges)
            games_dict = {}
            for playtest in playtests_without_challenges:
                game_id = playtest['game_to_test'][0] if playtest['game_to_test'] else 'unknown'
                if game_id not in games_dict:
                    games_dict[game_id] = []
                games_dict[game_id].append(playtest)
            
            print(f"📊 Found {len(games_dict)} unique games to process")
            print("=" * 60)
            
            challenges_generated = 0
            no_challenge_count = 0
            game_challenges = {}  # Track challenges per game
            
            # Process each game
            for game_index, (game_id, game_playtests) in enumerate(games_dict.items(), 1):
                game_name = game_playtests[0]['game_name'][0] if game_playtests[0]['game_name'] else "Unknown"
                print(f"\n🎮 Game #{game_index}/{len(games_dict)}: {game_name}")
                print(f"   Playtests for this game: {len(game_playtests)}")
                print("-" * 50)
                
                # Sort playtests by "Created At" field (most recent first) and limit to 5
                sorted_playtests = sorted(game_playtests, key=lambda x: x.get('created_time', ''), reverse=True)
                recent_playtests = sorted_playtests[:5]  # Get 5 most recent playtests
                
                # Calculate SSS earnable for each recent playtest and sort by earnable SSS (highest first)
                playtests_with_sss = []
                for playtest in recent_playtests:
                    sss_earnable = calculate_sss_earnable(playtest['sss_awarded'])
                    playtests_with_sss.append({
                        'playtest': playtest,
                        'sss_earnable': sss_earnable
                    })
                
                # Sort by SSS earnable (highest first) and take top 3
                playtests_with_sss.sort(key=lambda x: x['sss_earnable'], reverse=True)
                limited_playtests = [item['playtest'] for item in playtests_with_sss[:3]]  # Top 3 by SSS earnable
                
                print(f"   Processing {len(limited_playtests)} playtests (top 3 by SSS earnable from 5 most recent)")
                
                # Initialize challenges list for this game
                game_challenges[game_id] = []
                
                # Process each playtest for this game
                for playtest_index, playtest in enumerate(limited_playtests, 1):
                    print(f"\n   📝 Playtest #{playtest_index}/{len(limited_playtests)}")
                    print(f"   Player: {playtest['player_email'][0] if playtest['player_email'] else 'Unknown'}")
                    print(f"   Created: {playtest.get('created_time', 'Unknown')}")
                    
                    # Calculate SSS earnable for this playtest
                    sss_earnable = calculate_sss_earnable(playtest['sss_awarded'])
                    print(f"   SSS Earnable: {sss_earnable} (from {playtest['sss_awarded']} awarded)")
                    
                    # Prepare scores for the challenge generation
                    scores = {
                        'fun_score': playtest['fun_score'],
                        'art_score': playtest['art_score'],
                        'creativity_score': playtest['creativity_score'],
                        'audio_score': playtest['audio_score'],
                        'mood_score': playtest['mood_score']
                    }
                    
                    # Calculate SSS earnable
                    sss_earnable = calculate_sss_earnable(playtest['sss_awarded'])
                    
                    # Generate challenge with existing challenges context
                    challenge = generate_challenge_from_feedback(
                        playtest['feedback'], 
                        playtest['game_name'], 
                        scores,
                        existing_challenges=game_challenges[game_id]  # Pass existing challenges for this game
                    )
                    
                    print(f"   Challenge: {challenge}")
                    print(f"   SSS Earnable: {sss_earnable}")
                    
                    # Create record in Challenges table (only if challenge was found)
                    if challenge != "No challenge found":
                        # Add to game challenges list
                        game_challenges[game_id].append(challenge)
                        
                        challenge_record_data = {
                            "recipientEmail": playtest['owner_email'][0] if playtest['owner_email'] else "Unknown",
                            "Challenge": challenge,
                            "Earnable SSS": sss_earnable,
                            "AssignedGame": playtest['game_to_test'],  # This is a list of game IDs
                            "Status": "Not Submitted",
                            "SSS Earned": 0,
                            "FromPlaytest": [playtest['record_id']]  # Link to the original PlaytestTicket record
                        }
                        
                        # Create the record in the Challenges table
                        create_challenge_record(challenge_record_data)
                        challenges_generated += 1
                    else:
                        no_challenge_count += 1
                    
                    # Add a small delay to avoid rate limiting
                    import time
                    time.sleep(0.5)
                
                print(f"   ✅ Completed game: {game_name} ({len(game_challenges[game_id])} challenges generated)")
            
            print(f"\n🎯 Challenge Generation Summary:")
            print(f"  Total complete playtests: {len(complete_playtests)}")
            print(f"  Playtests already with challenges: {len(playtests_with_challenges)}")
            print(f"  Playtests processed for new challenges: {len(playtests_without_challenges)}")
            print(f"  New challenges generated: {challenges_generated}")
            print(f"  No challenge found: {no_challenge_count}")
            if len(playtests_without_challenges) > 0:
                print(f"  Success rate: {(challenges_generated/len(playtests_without_challenges)*100):.1f}%")
        
        print(f"\n🎯 Summary:")
        print(f"  Total complete playtests found: {len(complete_playtests)}")
        
        if complete_playtests:
            # Analyze feedback content
            feedback_count = sum(1 for p in complete_playtests if p['feedback'])
            fun_score_count = sum(1 for p in complete_playtests if p['fun_score'] is not None and p['fun_score'] != '')
            art_score_count = sum(1 for p in complete_playtests if p['art_score'] is not None and p['art_score'] != '')
            creativity_score_count = sum(1 for p in complete_playtests if p['creativity_score'] is not None and p['creativity_score'] != '')
            audio_score_count = sum(1 for p in complete_playtests if p['audio_score'] is not None and p['audio_score'] != '')
            mood_score_count = sum(1 for p in complete_playtests if p['mood_score'] is not None and p['mood_score'] != '')
            
            print(f"  Playtests with feedback: {feedback_count}")
            print(f"  Playtests with Fun scores: {fun_score_count}")
            print(f"  Playtests with Art scores: {art_score_count}")
            print(f"  Playtests with Creativity scores: {creativity_score_count}")
            print(f"  Playtests with Audio scores: {audio_score_count}")
            print(f"  Playtests with Mood scores: {mood_score_count}")
            
            # Show unique games and players
            unique_games = set()
            unique_players = set()
            
            for playtest in complete_playtests:
                if playtest['game_to_test']:
                    unique_games.update(playtest['game_to_test'])
                if playtest['player']:
                    unique_players.update(playtest['player'])
            
            print(f"  Unique games tested: {len(unique_games)}")
            print(f"  Unique players: {len(unique_players)}")
        else:
            print("  No complete playtests found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
