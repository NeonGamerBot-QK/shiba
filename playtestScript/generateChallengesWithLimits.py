import os
from dotenv import load_dotenv
import requests
import openai
import time
from collections import defaultdict

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

# Configuration
MAX_NOT_SUBMITTED_CHALLENGES = 3

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

def fetch_all_challenges():
    """Fetch all challenges to check current user limits"""
    print("🔍 Fetching existing challenges to check user limits...")
    
    all_challenges = []
    offset = None
    
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            page = airtable_request(f"{CHALLENGES_TABLE}?{requests.compat.urlencode(params)}", {
                'method': 'GET'
            })
            
            page_records = page.get('records', [])
            all_challenges.extend(page_records)
            offset = page.get('offset')
            
            if not offset:
                break
                
        except Exception as e:
            print(f"Error fetching challenges: {e}")
            break
    
    return all_challenges

def get_user_challenge_counts():
    """Get current challenge counts per user"""
    all_challenges = fetch_all_challenges()
    user_counts = defaultdict(lambda: defaultdict(int))
    
    for challenge in all_challenges:
        fields = challenge.get('fields', {})
        recipient_email = fields.get('recipientEmail', 'Unknown')
        status = fields.get('Status', 'Unknown')
        
        user_counts[recipient_email][status] += 1
    
    return user_counts

def can_user_receive_challenge(user_email, user_counts):
    """Check if a user can receive a new challenge (not exceeding the limit)"""
    not_submitted_count = user_counts.get(user_email, {}).get('Not Submitted', 0)
    return not_submitted_count < MAX_NOT_SUBMITTED_CHALLENGES

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
    
    return complete_playtests

def process_playtest_for_challenge(playtest, game_challenges, user_counts, test_number):
    """Process a single playtest to generate a challenge, with special handling for 4th test"""
    owner_email = playtest['owner_email'][0] if playtest['owner_email'] else "Unknown"
    
    # Check if user can receive a new challenge
    if not can_user_receive_challenge(owner_email, user_counts):
        print(f"   ⚠️  User {owner_email} already has {MAX_NOT_SUBMITTED_CHALLENGES} 'Not Submitted' challenges - skipping")
        return False, "User at limit"
    
    # Special handling for 4th test - reuse 3rd test without creating new record
    if test_number == 4:
        print(f"   🔄 4th test detected - reusing 3rd test challenge without creating new record")
        if len(game_challenges) >= 3:
            third_challenge = game_challenges[2]  # 0-indexed, so 2 is the 3rd challenge
            print(f"   📋 Reusing 3rd challenge: {third_challenge}")
            return True, "Reused 3rd test"
        else:
            print(f"   ⚠️  No 3rd challenge available to reuse")
            return False, "No 3rd challenge to reuse"
    
    # Regular challenge generation for tests 1-3
    scores = {
        'fun_score': playtest['fun_score'],
        'art_score': playtest['art_score'],
        'creativity_score': playtest['creativity_score'],
        'audio_score': playtest['audio_score'],
        'mood_score': playtest['mood_score']
    }
    
    # Generate challenge with existing challenges context
    challenge = generate_challenge_from_feedback(
        playtest['feedback'], 
        playtest['game_name'], 
        scores,
        existing_challenges=game_challenges
    )
    
    print(f"   Challenge: {challenge}")
    
    if challenge != "No challenge found":
        # Add to game challenges list
        game_challenges.append(challenge)
        
        # Calculate SSS earnable
        sss_earnable = calculate_sss_earnable(playtest['sss_awarded'])
        
        challenge_record_data = {
            "recipientEmail": owner_email,
            "Challenge": challenge,
            "Earnable SSS": sss_earnable,
            "AssignedGame": playtest['game_to_test'],
            "Status": "Not Submitted",
            "SSS Earned": 0,
            "FromPlaytest": [playtest['record_id']]
        }
        
        # Create the record in the Challenges table
        create_challenge_record(challenge_record_data)
        
        # Update user counts
        user_counts[owner_email]['Not Submitted'] += 1
        
        return True, "Challenge created"
    else:
        return False, "No challenge found"

def main():
    """Main function to generate challenges with user limits enforced"""
    print("🚀 Generate Challenges with User Limits - Enhanced Version")
    print("=" * 60)
    
    # Get current user challenge counts
    print("📊 Checking current user challenge limits...")
    user_counts = get_user_challenge_counts()
    
    # Show current violations
    violations = []
    for user_email, counts in user_counts.items():
        not_submitted = counts.get('Not Submitted', 0)
        if not_submitted > MAX_NOT_SUBMITTED_CHALLENGES:
            violations.append((user_email, not_submitted))
    
    if violations:
        print(f"⚠️  Current violations (users with >{MAX_NOT_SUBMITTED_CHALLENGES} 'Not Submitted'):")
        for email, count in violations:
            print(f"   {email}: {count} 'Not Submitted' challenges")
        print()
    
    # Ask for confirmation
    response = input("Do you want to generate challenges with limit enforcement? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Challenge generation cancelled")
        return
    
    try:
        complete_playtests = get_complete_playtests(show_details=False)
        
        if not complete_playtests:
            print("❌ No complete playtests found")
            return
        
        # Filter out playtests that already have challenges
        playtests_without_challenges = [p for p in complete_playtests if not p['has_existing_challenges']]
        
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
        skipped_limit_count = 0
        reused_4th_test_count = 0
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
            
            # Sort by SSS earnable (highest first) and take top 4 (to handle 4th test case)
            playtests_with_sss.sort(key=lambda x: x['sss_earnable'], reverse=True)
            limited_playtests = [item['playtest'] for item in playtests_with_sss[:4]]  # Top 4 by SSS earnable
            
            print(f"   Processing {len(limited_playtests)} playtests (top 4 by SSS earnable from 5 most recent)")
            
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
                
                # Process the playtest
                success, reason = process_playtest_for_challenge(
                    playtest, 
                    game_challenges[game_id], 
                    user_counts, 
                    playtest_index
                )
                
                if success:
                    if reason == "Reused 3rd test":
                        reused_4th_test_count += 1
                    else:
                        challenges_generated += 1
                else:
                    if reason == "User at limit":
                        skipped_limit_count += 1
                    elif reason == "No challenge found":
                        no_challenge_count += 1
                
                # Add a small delay to avoid rate limiting
                time.sleep(0.5)
            
            print(f"   ✅ Completed game: {game_name} ({len(game_challenges[game_id])} challenges generated)")
        
        print(f"\n🎯 Challenge Generation Summary:")
        print(f"  Total complete playtests: {len(complete_playtests)}")
        print(f"  Playtests processed for new challenges: {len(playtests_without_challenges)}")
        print(f"  New challenges generated: {challenges_generated}")
        print(f"  4th tests reused (no new record): {reused_4th_test_count}")
        print(f"  Skipped due to user limit: {skipped_limit_count}")
        print(f"  No challenge found: {no_challenge_count}")
        print(f"  Total processed: {challenges_generated + reused_4th_test_count + skipped_limit_count + no_challenge_count}")
        
        # Show final user counts
        print(f"\n📊 Final User Challenge Counts:")
        for user_email, counts in user_counts.items():
            not_submitted = counts.get('Not Submitted', 0)
            if not_submitted > 0:
                print(f"   {user_email}: {not_submitted} 'Not Submitted' challenges")
        
        # Check for any remaining violations
        final_violations = []
        for user_email, counts in user_counts.items():
            not_submitted = counts.get('Not Submitted', 0)
            if not_submitted > MAX_NOT_SUBMITTED_CHALLENGES:
                final_violations.append((user_email, not_submitted))
        
        if final_violations:
            print(f"\n⚠️  Remaining violations:")
            for email, count in final_violations:
                print(f"   {email}: {count} 'Not Submitted' challenges")
        else:
            print(f"\n✅ All users are now within the {MAX_NOT_SUBMITTED_CHALLENGES} 'Not Submitted' limit")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
