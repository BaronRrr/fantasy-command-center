#!/usr/bin/env python3
"""
Test the espn-api library with your league to see if it can detect draft picks
"""

try:
    from espn_api.football import League
    print("✅ ESPN API library imported successfully!")
except ImportError as e:
    print(f"❌ Failed to import ESPN API: {e}")
    exit(1)

def test_league_access():
    """Test basic league access"""
    print("\n🔍 TESTING LEAGUE ACCESS")
    print("=" * 50)
    
    league_id = 449753582
    year = 2025
    
    try:
        # Test public access first
        print(f"📊 Connecting to League {league_id} (Year {year})...")
        league = League(league_id=league_id, year=year)
        
        print(f"✅ League connected: {getattr(league, 'name', 'Unknown Name')}")
        print(f"📈 Teams: {len(getattr(league, 'teams', []))}")
        print(f"🏆 Current week: {getattr(league, 'current_week', 'Unknown')}")
        
        return league
        
    except Exception as e:
        print(f"❌ Public access failed: {e}")
        return None

def test_draft_access(league):
    """Test draft-specific functionality"""
    if not league:
        print("\n❌ No league to test draft access")
        return
        
    print("\n🎯 TESTING DRAFT ACCESS")
    print("=" * 50)
    
    try:
        # Check if league has draft attribute
        if hasattr(league, 'draft'):
            print("✅ League has draft attribute!")
            draft = league.draft
            print(f"📋 Draft object: {type(draft)}")
            
            # Try to get draft picks
            if hasattr(draft, 'picks'):
                picks = draft.picks
                print(f"🎯 Total draft picks found: {len(picks) if picks else 0}")
                
                if picks:
                    print("\n📊 DRAFT PICKS DETECTED:")
                    for i, pick in enumerate(picks[:10]):  # Show first 10
                        player_name = getattr(pick, 'player_name', 'Unknown Player')
                        team_id = getattr(pick, 'team_id', 'Unknown Team')
                        round_num = getattr(pick, 'round_num', 'Unknown Round')
                        pick_num = getattr(pick, 'pick_num', 'Unknown Pick')
                        
                        print(f"  Pick {i+1}: Round {round_num}, Pick {pick_num}")
                        print(f"           Team {team_id} → {player_name}")
                        
                        if i >= 5:  # Limit output
                            break
                else:
                    print("❌ No draft picks found in picks array")
            else:
                print("❌ Draft object has no 'picks' attribute")
                print(f"📋 Available draft attributes: {dir(draft)}")
        else:
            print("❌ League has no 'draft' attribute")
            print(f"📋 Available league attributes: {[attr for attr in dir(league) if not attr.startswith('_')]}")
            
    except Exception as e:
        print(f"❌ Draft access failed: {e}")

def test_teams_and_rosters(league):
    """Test team and roster access"""
    if not league:
        return
        
    print("\n👥 TESTING TEAMS AND ROSTERS")
    print("=" * 50)
    
    try:
        teams = getattr(league, 'teams', [])
        print(f"📊 Found {len(teams)} teams")
        
        for team in teams[:3]:  # Show first 3 teams
            team_id = getattr(team, 'team_id', 'Unknown')
            team_name = getattr(team, 'team_name', 'Unknown')
            owner = getattr(team, 'owner', 'Unknown')
            
            print(f"\n🏈 Team {team_id}: {team_name} (Owner: {owner})")
            
            # Check roster
            if hasattr(team, 'roster'):
                roster = team.roster
                print(f"  📋 Roster size: {len(roster) if roster else 0}")
                
                if roster:
                    for player in roster[:3]:  # Show first 3 players
                        name = getattr(player, 'name', 'Unknown Player')
                        position = getattr(player, 'position', 'Unknown Position')
                        print(f"    - {name} ({position})")
            else:
                print("  ❌ No roster attribute found")
                
    except Exception as e:
        print(f"❌ Teams/roster access failed: {e}")

def main():
    print("🏈 ESPN API LIBRARY TEST")
    print("Testing draft monitoring capabilities...")
    
    # Test league access
    league = test_league_access()
    
    # Test draft access
    test_draft_access(league)
    
    # Test teams and rosters
    test_teams_and_rosters(league)
    
    print("\n🎯 SUMMARY:")
    if league:
        print("✅ ESPN API library can connect to your league!")
        print("🎯 This might be the solution for live draft monitoring!")
        print("\n💡 Next steps:")
        print("1. Add authentication cookies for private league access")
        print("2. Test during active draft")
        print("3. Integrate with Discord monitoring system")
    else:
        print("❌ ESPN API library couldn't connect to league")
        print("💡 May need authentication cookies for private leagues")

if __name__ == "__main__":
    main()