import os
from dotenv import load_dotenv
import requests
import time
from collections import defaultdict

# Load environment variables from .env file
load_dotenv()

# Environment Variables
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")

# Airtable configuration
AIRTABLE_API_BASE = 'https://api.airtable.com/v0'
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

def fetch_all_challenges():
    """Fetch all challenges in batches of 100"""
    print("🔍 Fetching all challenges from Airtable...")
    print("=" * 60)
    
    all_challenges = []
    offset = None
    batch_count = 0
    
    while True:
        batch_count += 1
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            print(f"📦 Fetching batch {batch_count} (100 records per batch)...")
            page = airtable_request(f"{CHALLENGES_TABLE}?{requests.compat.urlencode(params)}", {
                'method': 'GET'
            })
            
            page_records = page.get('records', [])
            all_challenges.extend(page_records)
            offset = page.get('offset')
            
            print(f"   ✅ Fetched {len(page_records)} challenges in batch {batch_count}")
            print(f"   📊 Total challenges so far: {len(all_challenges)}")
            
            if not offset:
                break
                
            # Small delay to avoid rate limiting
            time.sleep(0.1)
                
        except Exception as e:
            print(f"❌ Error fetching batch {batch_count}: {e}")
            break
    
    print(f"\n🎯 Fetch Complete:")
    print(f"   Total batches: {batch_count}")
    print(f"   Total challenges fetched: {len(all_challenges)}")
    
    return all_challenges

def analyze_challenge_status_distribution(challenges):
    """Analyze the distribution of challenge statuses"""
    print("\n📊 Challenge Status Analysis")
    print("=" * 60)
    
    status_counts = defaultdict(int)
    user_status_counts = defaultdict(lambda: defaultdict(int))
    
    for challenge in challenges:
        fields = challenge.get('fields', {})
        status = fields.get('Status', 'Unknown')
        recipient_email = fields.get('recipientEmail', 'Unknown')
        
        status_counts[status] += 1
        user_status_counts[recipient_email][status] += 1
    
    print("Overall Status Distribution:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")
    
    print(f"\nTotal challenges: {sum(status_counts.values())}")
    
    return user_status_counts

def check_user_challenge_limits(user_status_counts, max_not_submitted=3):
    """Check if any users have more than the allowed 'Not Submitted' challenges"""
    print(f"\n🔍 Checking User Challenge Limits (max {max_not_submitted} 'Not Submitted' per user)")
    print("=" * 60)
    
    violations = []
    compliant_users = []
    
    for user_email, status_counts in user_status_counts.items():
        not_submitted_count = status_counts.get('Not Submitted', 0)
        
        if not_submitted_count > max_not_submitted:
            violations.append({
                'email': user_email,
                'not_submitted': not_submitted_count,
                'total_challenges': sum(status_counts.values()),
                'status_breakdown': dict(status_counts)
            })
        else:
            compliant_users.append({
                'email': user_email,
                'not_submitted': not_submitted_count,
                'total_challenges': sum(status_counts.values())
            })
    
    print(f"📊 Results:")
    print(f"   Users with violations: {len(violations)}")
    print(f"   Compliant users: {len(compliant_users)}")
    
    if violations:
        print(f"\n❌ Users with more than {max_not_submitted} 'Not Submitted' challenges:")
        for i, violation in enumerate(violations, 1):
            print(f"   {i}. {violation['email']}")
            print(f"      Not Submitted: {violation['not_submitted']}")
            print(f"      Total challenges: {violation['total_challenges']}")
            print(f"      Status breakdown: {violation['status_breakdown']}")
            print()
    else:
        print(f"\n✅ All users are compliant with the {max_not_submitted} 'Not Submitted' limit")
    
    return violations, compliant_users

def get_challenge_details_for_violations(violations, all_challenges):
    """Get detailed information about challenges for users with violations"""
    if not violations:
        return
    
    print(f"\n📋 Detailed Challenge Information for Violations")
    print("=" * 60)
    
    violation_emails = [v['email'] for v in violations]
    
    for email in violation_emails:
        print(f"\n👤 User: {email}")
        print("-" * 40)
        
        user_challenges = []
        for challenge in all_challenges:
            fields = challenge.get('fields', {})
            if fields.get('recipientEmail') == email:
                user_challenges.append({
                    'id': challenge.get('id'),
                    'challenge': fields.get('Challenge', 'No challenge text'),
                    'status': fields.get('Status', 'Unknown'),
                    'earnable_sss': fields.get('Earnable SSS', 0),
                    'sss_earned': fields.get('SSS Earned', 0),
                    'assigned_game': fields.get('AssignedGame', []),
                    'from_playtest': fields.get('FromPlaytest', []),
                    'created_time': fields.get('Created At', 'Unknown')
                })
        
        # Sort by status (Not Submitted first) then by created time
        user_challenges.sort(key=lambda x: (x['status'] != 'Not Submitted', x['created_time']))
        
        for i, challenge in enumerate(user_challenges, 1):
            print(f"   {i}. [{challenge['status']}] {challenge['challenge'][:60]}...")
            print(f"      ID: {challenge['id']}")
            print(f"      Earnable SSS: {challenge['earnable_sss']}")
            print(f"      Created: {challenge['created_time']}")
            if challenge['assigned_game']:
                print(f"      Game: {challenge['assigned_game']}")
            print()

def main():
    """Main function to fetch and analyze all challenges"""
    print("🚀 Challenge Analysis Tool")
    print("=" * 60)
    
    try:
        # Fetch all challenges
        all_challenges = fetch_all_challenges()
        
        if not all_challenges:
            print("❌ No challenges found in the database")
            return
        
        # Analyze status distribution
        user_status_counts = analyze_challenge_status_distribution(all_challenges)
        
        # Check for violations (more than 3 'Not Submitted' per user)
        violations, compliant_users = check_user_challenge_limits(user_status_counts, max_not_submitted=3)
        
        # Show detailed information for violations
        get_challenge_details_for_violations(violations, all_challenges)
        
        # Summary
        print(f"\n🎯 Final Summary:")
        print(f"   Total challenges in database: {len(all_challenges)}")
        print(f"   Total users with challenges: {len(user_status_counts)}")
        print(f"   Users with violations: {len(violations)}")
        print(f"   Compliant users: {len(compliant_users)}")
        
        if violations:
            print(f"\n⚠️  Action Required:")
            print(f"   {len(violations)} users have more than 3 'Not Submitted' challenges")
            print(f"   Consider running the script with limit enforcement")
        else:
            print(f"\n✅ All users are within the 3 'Not Submitted' limit")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
