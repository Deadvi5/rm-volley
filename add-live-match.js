// Add a live match to Gare.xls for testing
const XLSX = require('xlsx');
const fs = require('fs');

try {
    // Read the existing workbook
    const workbook = XLSX.readFile('Gare.xls');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to JSON to manipulate
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Get current date and time
    const now = new Date();
    const liveTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${String(liveTime.getHours()).padStart(2, '0')}:${String(liveTime.getMinutes()).padStart(2, '0')}`;

    // Add new live match
    const newMatch = {
        Data: dateStr,
        Ora: timeStr,
        SquadraCasa: 'RM Volley Prima Squadra',
        SquadraOspite: 'Olimpia Milano VB',
        Impianto: 'Palestra RM Volley - Via Roma 123',
        Campionato: 'Serie D',
        StatoDescrizione: 'da disputare',
        Risultato: '',
        Parziali: ''
    };

    // Add to data
    data.push(newMatch);

    // Create new worksheet
    const newWorksheet = XLSX.utils.json_to_sheet(data);

    // Update workbook
    workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;

    // Write back
    XLSX.writeFile(workbook, 'Gare.xls');

    console.log(`✅ Added live match:`);
    console.log(`   Date: ${dateStr}`);
    console.log(`   Time: ${timeStr}`);
    console.log(`   Match: RM Volley Prima Squadra vs Olimpia Milano VB`);

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
