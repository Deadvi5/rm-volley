# RM Volley Dashboard

## Project Overview

RM Volley Dashboard is a comprehensive web application for managing and displaying volleyball match data for RM Volley, a local volleyball organization with multiple teams based on player age groups. The system queries Excel files containing match schedules, displays results, standings, and detailed statistics for various teams.

## Project Scope

This project provides:
- **Match Data Management**: Downloads and processes match data from FIPAV (Italian Volleyball Federation) sources
- **Dashboard Interface**: Professional web dashboard showing team results, schedules, and statistics
- **Live Match Features**: Real-time match scoring and chat functionality
- **Player Statistics**: Scout application for tracking individual player performance
- **Team Standings**: Displays league standings for multiple divisions and age groups
- **Progressive Web App**: Installable PWA with offline capabilities

## Architecture

### Frontend Stack
- **Vanilla JavaScript** (ES6 modules): Main application logic
- **HTML5/CSS3**: Responsive UI with custom design system
- **Chart.js**: Data visualization
- **SheetJS (XLSX.js)**: Excel file parsing
- **Firebase Realtime Database**: Live match data and chat
- **Service Workers**: PWA functionality and offline support

### Backend/Data Processing
- **Python 3**: Data fetching and processing ([update_gare.py](update_gare.py))
- **Pandas**: Excel data manipulation
- **Requests**: HTTP downloads from FIPAV sources
- **GitHub Actions**: Automated daily data updates

### Data Flow
1. Python script downloads match data from FIPAV URLs (configured in [config.json](config.json))
2. Multiple Excel files are merged into [Gare.xls](Gare.xls)
3. League standings scraped and saved to [classifica.json](classifica.json)
4. Frontend loads Excel data using SheetJS
5. Firebase provides real-time updates for live matches
6. GitHub Actions runs [update_gare.py](.github/workflows/update_matches.yml) daily at 08:00 UTC

## Key Files

### Configuration
- **[config.json](config.json)**: Central configuration for team names, categories, leagues, and data sources
- **[manifest.json](manifest.json)**: PWA manifest for app installation
- **[firebase-config.js](firebase-config.js)**: Firebase configuration

### Core Application
- **[index.html](index.html)**: Main dashboard page
- **[app.js](app.js)**: Main dashboard logic (58KB) - processes match data, renders views
- **[styles.css](styles.css)**: Complete design system (51KB)
- **[utils.js](utils.js)**: Utility functions (debounce, throttle, etc.)

### Features
- **[scout.html](scout.html)** / **[scout.js](scout.js)**: Player scouting application
- **[live-match.html](live-match.html)** / **[live-match.js](live-match.js)**: Live match scoring and chat
- **[player-stats.html](player-stats.html)** / **[player-stats.js](player-stats.js)**: Player statistics aggregation
- **[social.html](social.html)** / **[social.js](social.js)**: Social media content generation

### Authentication
- **[login.html](login.html)**: Admin/user login page
- **[auth-simple.js](auth-simple.js)**: Session-based authentication
- **[auth-tabs.js](auth-tabs.js)**: Tab visibility controls

### Data Processing
- **[update_gare.py](update_gare.py)**: Main Python script (395 lines)
  - Downloads Excel files from FIPAV
  - Merges multiple sources
  - Scrapes league standings
  - Handles virtual environment setup
- **[update_gare.sh](update_gare.sh)**: Bash wrapper for automation

### PWA/Service Worker
- **[sw.js](sw.js)**: Service worker for offline functionality
- **[manifest.json](manifest.json)**: PWA configuration

### Documentation
- **[README.md](README.md)**: Quick setup guide
- **[CONFIG.md](CONFIG.md)**: Configuration documentation
- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**: Firebase setup instructions
- **[FIREBASE_RULES.md](FIREBASE_RULES.md)**: Firebase security rules
- **[PWA_INSTALL.md](PWA_INSTALL.md)**: PWA installation guide

## Team Structure

RM Volley has multiple teams organized by age:
- **Serie D Femminile**: Senior women's team
- **Seconda Divisione F**: Second division teams (multiple groups)
- **Under 18 F**: Youth team (18 and under)
- **Under 16 F**: Youth team (16 and under)
- **Under 14 F**: Youth team (14 and under, multiple groups)

Teams are identified in match data by patterns like "RM VOLLEY #18" or "RMVOLLEY #2".

## Configuration System

All configuration is centralized in [config.json](config.json):

```json
{
  "team": {
    "name": "RM Volley",
    "matchPatterns": ["RM VOLLEY", "RMVOLLEY"]  // Pattern matching for team identification
  },
  "categories": {
    "2": "Seconda Div. F",  // Maps team number to category name
    "18": "Under 18 F"
  },
  "leagues": {
    "Serie D Femminile": "https://..."  // League name -> standings URL
  },
  "dataSources": [
    "https://fipav.../esporta-risultati.aspx?..."  // FIPAV export URLs
  ],
  "output": {
    "matchesFile": "Gare.xls",
    "standingsFile": "classifica.json"
  },
  "admins": [...],  // Admin users with password hashes
  "playerRoles": [...]  // Valid player positions
}
```

See [CONFIG.md](CONFIG.md) for detailed configuration documentation.

## Data Sources

### Match Data
Data is fetched from FIPAV (Federazione Italiana Pallavolo) provincial and regional portals:
- **FIPAV Piacenza**: Provincial committee matches
- **CRER (Emilia-Romagna)**: Regional committee matches

URLs are configured in `config.json` under `dataSources`.

### League Standings
Standings are scraped from FIPAV league pages using pandas `read_html()`:
- Each league URL in `config.json.leagues` is fetched
- HTML tables are parsed and converted to JSON
- Saved to `classifica.json`

## Features

### Dashboard ([index.html](index.html))
- **Overview Tab**: Key metrics, recent results, upcoming matches
- **Teams Tab**: Team cards with records, stats, and standings
- **Matches Tab**: Searchable/filterable match list
- **Stats Tab**: Charts for wins/losses, set statistics, performance trends
- **Insights Tab**: Advanced analytics and trends
- **Live Match Integration**: Displays live scores from Firebase
- **Pull-to-refresh**: Mobile refresh gesture

### Scout Application ([scout.html](scout.html))
Admin tool for tracking player performance during matches:
- Select match and roster
- Record player actions (attacks, blocks, digs, serves, etc.)
- Track success/error rates
- Session persistence in Firebase
- Export statistics

### Live Match ([live-match.html](live-match.html))
Real-time match experience:
- Live score updates (set-by-set)
- Team chat for fans
- Message expiry (4 hours)
- Username-based participation
- Firebase Realtime Database sync

### Player Statistics ([player-stats.html](player-stats.html))
Aggregated player performance:
- Search and filter by team/position
- Performance metrics from scout sessions
- Player comparison
- Export capabilities

### Social Media ([social.html](social.html))
Admin tool for generating social media graphics:
- Match result cards
- Team standings graphics
- Player highlights
- Downloadable images

## Authentication

Simple hash-based authentication system:
- Admin credentials stored in `config.json`
- SHA-256 password hashing
- Session timeout (8 hours default)
- Role-based access (admin, socialmediamanager)
- No backend required

Generate password hash using [hash-generator.html](hash-generator.html).

## Automation

### GitHub Actions Workflow
[.github/workflows/update_matches.yml](.github/workflows/update_matches.yml):
- **Trigger**: Daily at 08:00 UTC (09:00 CET)
- **Process**:
  1. Checkout repository
  2. Setup Python 3.11
  3. Install dependencies
  4. Run `update_gare.py`
  5. Commit updated `Gare.xls` and `classifica.json`
  6. Push to repository

This ensures match data is always fresh without manual intervention.

## Development Workflow

### Adding a New Team
1. Update `config.json`:
   - Add team number to `categories`
   - Verify `matchPatterns` captures team name variations
2. Add league to `leagues` if new division
3. Run `python update_gare.py` to fetch data
4. Refresh dashboard

### Adding a New League
1. Find league standings URL on FIPAV portal
2. Add to `config.json` under `leagues`
3. Run `python update_gare.py`
4. Dashboard will automatically display new league

### Modifying Data Sources
1. Update `dataSources` array in `config.json`
2. Run `python update_gare.py` to test
3. Verify merged data in `Gare.xls`

### Local Development
1. Clone repository
2. Open `index.html` in browser (or use local server)
3. Excel file `Gare.xls` must be present
4. For Firebase features, configure `firebase-config.js`

### Testing
- **Data Updates**: Run `python update_gare.py` locally
- **Dashboard**: Open in multiple browsers/devices
- **PWA**: Test installation on mobile devices
- **Live Features**: Requires Firebase configuration

## Performance Optimizations

The codebase includes several performance enhancements:
- **Debouncing/Throttling**: Search and filter operations ([utils.js](utils.js))
- **Chunk Processing**: Large datasets processed in chunks
- **Chart Caching**: Prevents unnecessary chart re-renders
- **Lazy Loading**: Images and non-critical resources
- **Service Worker**: Caches static assets
- **Pull-to-Refresh**: Efficient mobile data refresh

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Required features:
- ES6 modules
- Fetch API
- Service Workers (for PWA)
- IndexedDB (for offline)

## Deployment

The app is static and can be deployed to:
- **GitHub Pages**: Automatically served from repo
- **Netlify/Vercel**: Zero-config deployment
- **Traditional hosting**: Upload all files
- **Local**: Open `index.html` directly

No build process required - all files are ready to serve.

## Security Considerations

- **Authentication**: Client-side hash comparison (not production-grade)
- **Firebase Rules**: Configure in Firebase Console (see [FIREBASE_RULES.md](FIREBASE_RULES.md))
- **API Keys**: Firebase config is public (normal for client-side apps)
- **Admin Actions**: Require authentication
- **Data Validation**: Input sanitization for user-generated content

## Common Tasks

### Update Match Data Manually
```bash
python update_gare.py
```

### Add Admin User
1. Generate hash using [hash-generator.html](hash-generator.html)
2. Add to `config.json` `admins` array:
```json
{
  "email": "user@example.com",
  "passwordHash": "...",
  "name": "User Name",
  "role": "admin"
}
```

### Change Team Branding
1. Replace logo in `media/rmlogo.png`
2. Update colors in [styles.css](styles.css) (CSS variables at top)
3. Update `manifest.json` name and colors
4. Update icons in `media/` directory

### Export Data
- Match data: `Gare.xls` (Excel format)
- Standings: `classifica.json` (JSON format)
- Scout sessions: Firebase export
- Player stats: In-app export feature

## Troubleshooting

### Dashboard Not Loading
- Check browser console for errors
- Verify `Gare.xls` exists and is valid
- Check CDN availability (SheetJS, Chart.js)
- Clear browser cache

### Teams Not Appearing
- Verify `matchPatterns` in `config.json`
- Check team name format in Excel file
- Ensure category mapping exists

### Standings Not Updating
- Verify league URLs in `config.json`
- Check FIPAV website structure hasn't changed
- Run `python update_gare.py` manually to see errors

### Live Features Not Working
- Verify Firebase configuration
- Check Firebase console for errors
- Ensure Firebase rules allow read/write
- Check browser console for connection errors

### Python Script Errors
- Install dependencies: `pip install -r requirements.txt`
- Or use auto-setup: script creates virtual environment automatically
- Check FIPAV URLs are accessible
- Verify pandas can read Excel files

## Dependencies

### JavaScript (CDN)
- SheetJS (xlsx) 0.18.5
- Chart.js 4.4.0
- Firebase 10.7.1

### Python (requirements.txt)
- requests
- pandas
- openpyxl
- xlrd
- lxml
- html5lib

## File Size Reference
- Total codebase: ~350KB (uncompressed)
- [app.js](app.js): 58KB
- [styles.css](styles.css): 51KB
- [scout.js](scout.js): 30KB
- [live-match.js](live-match.js): 20KB

With gzip compression: ~80-100KB total

## Future Enhancements

Potential improvements (not currently implemented):
- Backend API for authentication
- Database storage for historical data
- Advanced analytics/ML predictions
- Video integration
- Multi-language support
- Admin dashboard for configuration
- Mobile native apps
- Real-time notifications

## Version Control

- **Git**: Repository uses git for version control
- **Branches**: Main branch for production
- **Commits**: Automated commits from GitHub Actions with timestamp
- **Backups**: Old Excel files saved in `backups/` directory

## Contact & Support

For issues or questions:
- Repository: https://github.com/[your-org]/rm-volley
- Documentation: See `*.md` files in root
- FIPAV: https://www.federvolley.it

---

**Last Updated**: 2026-01-17
**Version**: 1.0
**Maintained By**: RM Volley Technical Team
