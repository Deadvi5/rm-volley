# 🚀 Quick Setup Guide

## Installation

1. **Download all files:**
   - `index.html`
   - `styles.css`
   - `app.js`

2. **Place them in your project directory:**
   ```
   your-project/
   ├── index.html
   ├── styles.css
   ├── app.js
   └── Gare.xls  (your existing Excel file)
   ```

3. **Open `index.html` in your browser**

That's it! 🎉

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- `Gare.xls` file in the same directory
- Internet connection (for Chart.js and SheetJS CDN)

## What Changed?

✅ **All functionality preserved** - Everything works exactly as before
✅ **Zero configuration needed** - Just place files and open
✅ **Backwards compatible** - Works with your existing Excel data

## Testing Checklist

After setup, verify:
- [ ] Dashboard loads correctly
- [ ] Header statistics display
- [ ] All tabs work (Overview, Teams, Matches, Stats, Insights)
- [ ] Team cards show data
- [ ] Match cards display properly
- [ ] Filters work in Matches tab
- [ ] Charts render in Stats tab
- [ ] Team detail modal opens
- [ ] Mobile view is responsive
- [ ] Pull-to-refresh works on mobile

## Customization

### Change Primary Color
Edit `styles.css` line 26:
```css
--primary: #0066FF;  /* Change this */
```

### Adjust Spacing
Edit `styles.css` line 49:
```css
--space-4: 1rem;  /* Base spacing unit */
```

### Modify Animations
Edit `styles.css` line 56:
```css
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
```

## ⚙️ Configuration

All settings are managed in `config.json` for easy customization without modifying code.

### What You Can Configure

- **Team name and patterns**: Change which teams are tracked
- **Categories**: Define age groups and divisions  
- **Leagues**: Add or remove leagues to display standings
- **Data sources**: Configure FIPAV export URLs

For detailed instructions, see [CONFIG.md](CONFIG.md).

### Example config.json

```json
{
  "team": {
    "name": "Your Team Name",
    "matchPatterns": ["YOUR TEAM", "YOURTEAM"]
  },
  "categories": {
    "18": "Under 18 F"
  }
}
```


## Mobile Testing

Test on actual devices or use browser DevTools:
1. Open DevTools (F12)
2. Click device toolbar icon
3. Select mobile device
4. Test touch interactions

## Troubleshooting

### Dashboard doesn't load
- Check browser console for errors (F12)
- Verify `Gare.xls` is in the correct location
- Check internet connection for CDN resources

### Styles look wrong
- Clear browser cache (Ctrl+Shift+Delete)
- Verify `styles.css` is linked correctly
- Check browser console for CSS errors

### JavaScript not working
- Verify `app.js` is linked correctly
- Check browser console for JavaScript errors
- Ensure browser supports ES6+

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Performance Tips

1. **Minimize Chart.js animations** for better mobile performance
2. **Use local CDN copies** for offline support
3. **Compress Excel files** for faster loading

## Next Steps

1. ✅ Test on all target devices
2. ✅ Customize colors to match brand
3. ✅ Add your own logo in the header
4. ✅ Deploy to your hosting platform

## Support

Refer to:
- `IMPROVEMENTS.md`Per ulteriori dettagli e personalizzazione, consulta la [documentazione completa](README.md).

## ⚙️ Configuration

All settings for team names, categories, leagues, and data sources are managed in `config.json`. This makes it easy to customize the dashboard for different teams or organizations without modifying the code.

### Quick Configuration

Edit `config.json` to customize:
- **Team name and patterns**: Change which teams are tracked
- **Categories**: Define age groups and divisions
- **Leagues**: Add or remove leagues to display standings
- **Data sources**: Configure FIPAV export URLs

For detailed configuration instructions, see [CONFIG.md](CONFIG.md).

### Example Configuration

```json
{
  "team": {
    "name": "Your Team Name",
    "matchPatterns": ["YOUR TEAM", "YOURTEAM"]
  },
  "categories": {
    "18": "Under 18 F"
  },
  "leagues": {
    "Serie D": "https://fipav.example/classifica.aspx?CId=12345"
  },
  "dataSources": [
    "https://fipav.example/esporta-risultati.aspx?..."
  ]
}
```

## ✨ Features/after comparison
- Browser console - Error messages and debugging

## File Sizes

- `index.html`: 9.5 KB
- `styles.css`: 32 KB
- `app.js`: 40 KB
- **Total**: ~82 KB (uncompressed)

With gzip compression: ~25-30 KB

## Deployment

Works with any web hosting:
- GitHub Pages
- Netlify
- Vercel
- Traditional web hosting
- Local file system

No build process required! 🎯

---

**Enjoy your new professional dashboard!** 🏐✨