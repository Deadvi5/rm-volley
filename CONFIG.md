# Configuration Guide

This document explains how to configure the RM Volley Dashboard using the `config.json` file.

## Configuration File Structure

The `config.json` file contains all configurable settings for the dashboard. Here's the complete structure:

```json
{
  "team": {
    "name": "RM Volley",
    "matchPatterns": ["RM VOLLEY", "RMVOLLEY"]
  },
  "categories": {
    "2": "Seconda Div. F",
    "13": "Under 14 F",
    "14": "Under 14 F",
    "15": "Under 14 F",
    "16": "Under 16 F",
    "18": "Under 18 F"
  },
  "leagues": {
    "Serie D Femminile": "https://crer.portalefipav.net/classifica.aspx?CId=84906",
    "Seconda Div. F Gir. C": "https://www.fipavpiacenza.it/classifica.aspx?CId=85893",
    "Seconda Div. F Gir. E": "https://www.fipavpiacenza.it/classifica.aspx?CId=87068",
    "Under 18 F Gir. A": "https://www.fipavpiacenza.it/classifica.aspx?CId=85960",
    "Under 16 F Gir. A": "https://www.fipavpiacenza.it/classifica.aspx?CId=85962",
    "Under 16 F Gir. B": "https://www.fipavpiacenza.it/classifica.aspx?CId=85963",
    "Under 14 F Gir. A": "https://www.fipavpiacenza.it/classifica.aspx?CId=85965",
    "Under 14 F Gir. C": "https://www.fipavpiacenza.it/classifica.aspx?CId=85968",
    "Under 14 F Gir. D": "https://www.fipavpiacenza.it/classifica.aspx?CId=86960",
    "Under 14 F Gir. E": "https://www.fipavpiacenza.it/classifica.aspx?CId=86961"
  },
  "dataSources": [
    "https://www.fipavpiacenza.it/esporta-risultati.aspx?ComitatoId=74&StId=2336&DataDa=&StatoGara=&CId=&SId=3953&PId=9653",
    "https://crer.portalefipav.net/esporta-risultati.aspx?ComitatoId=35&StId=2297&DataDa=&StatoGara=&CId=&SId=3953&PId=29422"
  ],
  "output": {
    "matchesFile": "Gare.xls",
    "standingsFile": "classifica.json"
  }
}
```

## Configuration Sections

### 1. Team Settings

```json
"team": {
  "name": "RM Volley",
  "matchPatterns": ["RM VOLLEY", "RMVOLLEY"]
}
```

- **name**: The display name of your volleyball organization
- **matchPatterns**: Array of text patterns to identify your teams in the match data
  - Teams are matched if their name contains any of these patterns (case-insensitive)
  - Add variations of your team name to ensure all teams are captured

**Example**: If your team is called "AC Milan Volley", use:
```json
"team": {
  "name": "AC Milan Volley",
  "matchPatterns": ["AC MILAN", "ACMILAN VOLLEY"]
}
```

### 2. Categories

```json
"categories": {
  "2": "Seconda Div. F",
  "13": "Under 14 F",
  "14": "Under 14 F",
  "15": "Under 14 F",
  "16": "Under 16 F",
  "18": "Under 18 F"
}
```

Maps team numbers (extracted from team names like `#2`, `#18`) to category display names.

**How to modify**:
1. Identify the number in your team names (e.g., `RMVOLLEY #18`)
2. Add or modify the mapping: `"18": "Under 18 Femminile"`

**Example**:
```json
"categories": {
  "1": "Prima Squadra",
  "2": "Seconda Squadra",
  "U19": "Under 19"
}
```

### 3. Leagues

```json
"leagues": {
  "Serie D Femminile": "https://crer.portalefipav.net/classifica.aspx?CId=84906",
  ...
}
```

Maps league display names to their standings page URLs.

**How to add a league**:
1. Find the standings page URL on the FIPAV portal
2. Add an entry: `"League Name": "URL"`

**How to remove a league**:
- Simply delete the line from the configuration

### 4. Data Sources

```json
"dataSources": [
  "https://www.fipavpiacenza.it/esporta-risultati.aspx?...",
  "https://crer.portalefipav.net/esporta-risultati.aspx?..."
]
```

Array of URLs to download match data from (FIPAV export URLs).

**How to modify**:
1. Navigate to your FIPAV committee's website
2. Find the "Esporta Risultati" (Export Results) function
3. Copy the full URL and add it to this array

### 5. Output Files

```json
"output": {
  "matchesFile": "Gare.xls",
  "standingsFile": "classifica.json"
}
```

Specifies the output file names for downloaded data.

- **matchesFile**: Name of the merged Excel file with all matches
- **standingsFile**: Name of the JSON file with league standings

**Note**: Generally, you shouldn't need to change these unless you have a specific reason.

## Making Changes

### Step 1: Edit config.json
Open `config.json` in any text editor and make your changes.

### Step 2: Validate JSON
Ensure your JSON is valid using a JSON validator or by running:
```bash
python -c "import json; json.load(open('config.json'))"
```

### Step 3: Update Data
Run the update script to download fresh data:
```bash
python update_gare.py
```

### Step 4: Refresh Dashboard
Reload your browser to see the changes in the dashboard.

## Common Tasks

### Change Team Name
```json
"team": {
  "name": "Your New Team Name",
  "matchPatterns": ["YOUR TEAM", "YOURTEAM"]
}
```

### Add a New Category
```json
"categories": {
  "20": "Under 20 F",
  // ... existing categories
}
```

### Add a New League
```json
"leagues": {
  "New League Name": "https://fipav-site.com/classifica.aspx?CId=12345",
  // ... existing leagues
}
```

### Change Data Source
1. Remove old URLs from `dataSources` array
2. Add new URLs to the array

## Troubleshooting

### Teams Not Appearing
- Check that your `matchPatterns` include all variations of your team name
- Patterns are case-insensitive but must be substring matches
- Try adding more specific or more general patterns

### Categories Show as "Sconosciuto"
- Verify the team number in the team name matches a key in `categories`
- Team numbers are extracted from patterns like `#14` or `#18`

### Leagues Not Loading
- Verify the league URLs are accessible
- Check that URLs are complete and properly formatted
- Ensure the FIPAV website structure hasn't changed

### Configuration Not Loading
- Verify `config.json` is valid JSON (use a validator)
- Check browser console for error messages
- Ensure `config.json` is in the same directory as `index.html`

## Example: Configuring for a Different Team

If you want to use this dashboard for "Pallavolo Milano", here's how you'd configure it:

```json
{
  "team": {
    "name": "Pallavolo Milano",
    "matchPatterns": ["PALLAVOLO MILANO", "PLV MILANO", "PLVMILANO"]
  },
  "categories": {
    "S": "Serie C",
    "U19": "Under 19",
    "U16": "Under 16"
  },
  "leagues": {
    "Serie C Lombardia": "https://fipavlombardia.it/classifica.aspx?CId=xxxxx"
  },
  "dataSources": [
    "https://fipavlombardia.it/esporta-risultati.aspx?..."
  ],
  "output": {
    "matchesFile": "Gare.xls",
    "standingsFile": "classifica.json"
  }
}
```

## Need Help?

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Run the Python script with verbose output
3. Validate your JSON configuration
4. Verify all URLs are accessible
