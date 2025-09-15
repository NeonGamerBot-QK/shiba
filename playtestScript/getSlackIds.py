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
USERS_TABLE = 'Users'

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

def fetch_all_users():
    """Fetch all users from the Users table in batches of 100"""
    print("🔍 Fetching all users from Airtable...")
    print("=" * 60)
    
    all_users = []
    offset = None
    batch_count = 0
    
    while True:
        batch_count += 1
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            print(f"📦 Fetching batch {batch_count} (100 records per batch)...")
            page = airtable_request(f"{USERS_TABLE}?{requests.compat.urlencode(params)}", {
                'method': 'GET'
            })
            
            page_records = page.get('records', [])
            all_users.extend(page_records)
            offset = page.get('offset')
            
            print(f"   ✅ Fetched {len(page_records)} users in batch {batch_count}")
            print(f"   📊 Total users so far: {len(all_users)}")
            
            if not offset:
                break
                
            # Small delay to avoid rate limiting
            time.sleep(0.1)
                
        except Exception as e:
            print(f"❌ Error fetching batch {batch_count}: {e}")
            break
    
    print(f"\n🎯 Fetch Complete:")
    print(f"   Total batches: {batch_count}")
    print(f"   Total users fetched: {len(all_users)}")
    
    return all_users

def extract_slack_ids(users):
    """Extract and analyze Slack IDs from user records"""
    print("\n📊 Slack ID Analysis")
    print("=" * 60)
    
    slack_data = []
    slack_id_counts = defaultdict(int)
    
    for user in users:
        fields = user.get('fields', {})
        record_id = user.get('id')
        
        # Get various possible Slack ID field names
        slack_id = (fields.get('slack id') or 
                   fields.get('slack_id') or 
                   fields.get('Slack ID') or 
                   fields.get('SlackId') or
                   fields.get('slackId'))
        
        # Get other user info
        email = fields.get('email', 'No email')
        first_name = fields.get('First Name', 'No first name')
        last_name = fields.get('Last Name', 'No last name')
        github_username = fields.get('github username', 'No GitHub')
        
        user_data = {
            'record_id': record_id,
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'github_username': github_username,
            'slack_id': slack_id,
            'has_slack_id': bool(slack_id)
        }
        
        slack_data.append(user_data)
        
        if slack_id:
            slack_id_counts[slack_id] += 1
    
    return slack_data, slack_id_counts

def analyze_slack_ids(slack_data, slack_id_counts):
    """Analyze the Slack ID data and show statistics"""
    print(f"\n📈 Slack ID Statistics:")
    print(f"   Total users: {len(slack_data)}")
    
    users_with_slack = [user for user in slack_data if user['has_slack_id']]
    users_without_slack = [user for user in slack_data if not user['has_slack_id']]
    
    print(f"   Users with Slack ID: {len(users_with_slack)}")
    print(f"   Users without Slack ID: {len(users_without_slack)}")
    print(f"   Coverage: {(len(users_with_slack)/len(slack_data)*100):.1f}%")
    
    # Check for duplicate Slack IDs
    duplicates = {slack_id: count for slack_id, count in slack_id_counts.items() if count > 1}
    if duplicates:
        print(f"\n⚠️  Duplicate Slack IDs found:")
        for slack_id, count in duplicates.items():
            print(f"   {slack_id}: used by {count} users")
    else:
        print(f"\n✅ No duplicate Slack IDs found")
    
    return users_with_slack, users_without_slack

def display_slack_ids(users_with_slack, show_details=False):
    """Display the Slack IDs in various formats"""
    print(f"\n📋 Slack IDs List")
    print("=" * 60)
    
    if not users_with_slack:
        print("❌ No users with Slack IDs found")
        return
    
    # Simple list format
    print(f"\n🔗 Simple Slack ID List ({len(users_with_slack)} IDs):")
    print("-" * 40)
    for user in users_with_slack:
        print(f"   {user['slack_id']}")
    
    # Detailed format
    if show_details:
        print(f"\n📊 Detailed User Information:")
        print("-" * 80)
        for i, user in enumerate(users_with_slack, 1):
            print(f"{i:3d}. {user['slack_id']}")
            print(f"     Email: {user['email']}")
            print(f"     Name: {user['first_name']} {user['last_name']}")
            print(f"     GitHub: {user['github_username']}")
            print(f"     Record ID: {user['record_id']}")
            print()
    
    # CSV format
    print(f"\n📄 CSV Format (for easy copying):")
    print("-" * 40)
    slack_ids_csv = ",".join([user['slack_id'] for user in users_with_slack])
    print(slack_ids_csv)
    
    # JSON format
    print(f"\n🔧 JSON Format:")
    print("-" * 40)
    slack_ids_json = [user['slack_id'] for user in users_with_slack]
    import json
    print(json.dumps(slack_ids_json, indent=2))

def display_users_without_slack(users_without_slack, limit=20):
    """Display users who don't have Slack IDs"""
    if not users_without_slack:
        return
    
    print(f"\n⚠️  Users Without Slack IDs ({len(users_without_slack)} total):")
    print("-" * 60)
    
    # Show first N users without Slack IDs
    for i, user in enumerate(users_without_slack[:limit], 1):
        print(f"{i:3d}. {user['email']} - {user['first_name']} {user['last_name']}")
    
    if len(users_without_slack) > limit:
        print(f"    ... and {len(users_without_slack) - limit} more users without Slack IDs")

def save_to_file(slack_data, users_with_slack, users_without_slack):
    """Save the data to files for easy access"""
    import json
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save all user data
    all_data_file = f"shiba_users_data_{timestamp}.json"
    with open(all_data_file, 'w') as f:
        json.dump(slack_data, f, indent=2)
    print(f"\n💾 Saved complete user data to: {all_data_file}")
    
    # Save just Slack IDs
    slack_ids_file = f"shiba_slack_ids_{timestamp}.txt"
    with open(slack_ids_file, 'w') as f:
        for user in users_with_slack:
            f.write(f"{user['slack_id']}\n")
    print(f"💾 Saved Slack IDs list to: {slack_ids_file}")
    
    # Save Slack IDs as CSV
    slack_csv_file = f"shiba_slack_ids_{timestamp}.csv"
    with open(slack_csv_file, 'w') as f:
        f.write("slack_id,email,first_name,last_name,github_username,record_id\n")
        for user in users_with_slack:
            f.write(f"{user['slack_id']},{user['email']},{user['first_name']},{user['last_name']},{user['github_username']},{user['record_id']}\n")
    print(f"💾 Saved Slack IDs CSV to: {slack_csv_file}")

def main():
    """Main function to fetch and display all Slack IDs"""
    print("🚀 Shiba Slack ID Fetcher")
    print("=" * 60)
    
    try:
        # Fetch all users
        all_users = fetch_all_users()
        
        if not all_users:
            print("❌ No users found in the database")
            return
        
        # Extract Slack IDs
        slack_data, slack_id_counts = extract_slack_ids(all_users)
        
        # Analyze the data
        users_with_slack, users_without_slack = analyze_slack_ids(slack_data, slack_id_counts)
        
        # Ask user what level of detail they want
        print(f"\nChoose display option:")
        print("1. Simple list only")
        print("2. Simple list + users without Slack IDs")
        print("3. Detailed information + save to files")
        
        try:
            choice = input("Enter your choice (1, 2, or 3): ").strip()
        except KeyboardInterrupt:
            print("\n❌ Operation cancelled by user")
            return
        
        # Display based on choice
        if choice == "1":
            display_slack_ids(users_with_slack, show_details=False)
        elif choice == "2":
            display_slack_ids(users_with_slack, show_details=False)
            display_users_without_slack(users_without_slack)
        elif choice == "3":
            display_slack_ids(users_with_slack, show_details=True)
            display_users_without_slack(users_without_slack)
            save_to_file(slack_data, users_with_slack, users_without_slack)
        else:
            print("❌ Invalid choice, showing simple list")
            display_slack_ids(users_with_slack, show_details=False)
        
        print(f"\n🎯 Summary:")
        print(f"   Total users: {len(slack_data)}")
        print(f"   Users with Slack IDs: {len(users_with_slack)}")
        print(f"   Users without Slack IDs: {len(users_without_slack)}")
        print(f"   Coverage: {(len(users_with_slack)/len(slack_data)*100):.1f}%")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
