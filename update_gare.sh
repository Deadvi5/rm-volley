#!/bin/bash
# ============================================================
#  RM Volley Dashboard - Aggiornamento Dati (Linux/Mac)
# ============================================================
#  Questo script scarica e aggiorna automaticamente i dati
#  delle partite da FIPAV
# ============================================================

echo ""
echo "============================================================"
echo "  RM Volley - Aggiornamento Dati Partite"
echo "============================================================"
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica che Python sia installato
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERRORE]${NC} Python 3 non trovato!"
    echo "Installa Python 3 da: https://www.python.org/downloads/"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Python 3 trovato: $(python3 --version)"
echo ""

# Verifica dipendenze
echo "Verifica dipendenze Python..."
if python3 -c "import pandas, openpyxl, xlrd, requests" 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Dipendenze installate"
else
    echo -e "${YELLOW}[AVVISO]${NC} Dipendenze mancanti. Installazione in corso..."
    
    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
    else
        pip3 install pandas openpyxl xlrd requests
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERRORE]${NC} Impossibile installare le dipendenze"
        exit 1
    fi
fi

echo ""
echo "============================================================"
echo "  Avvio aggiornamento..."
echo "============================================================"
echo ""

# Esegui lo script Python
python3 update_gare.py

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo -e "  ${GREEN}[SUCCESSO]${NC} Aggiornamento completato!"
    echo "============================================================"
    echo ""
    echo "Il file Gare.xls è stato aggiornato."
    echo "Puoi ora aprire il dashboard nel browser."
    echo ""
    
    # Opzionale: apri automaticamente il dashboard
    if [ -f "rmvolley-dashboard.html" ]; then
        read -p "Vuoi aprire il dashboard ora? (s/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            # Rileva il sistema operativo e apri il browser
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                open rmvolley-dashboard.html
            elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                # Linux
                xdg-open rmvolley-dashboard.html
            fi
        fi
    fi
else
    echo ""
    echo "============================================================"
    echo -e "  ${RED}[ERRORE]${NC} Aggiornamento fallito"
    echo "============================================================"
    echo ""
    echo "Controlla i messaggi di errore sopra."
    echo "Verifica la connessione internet e riprova."
    echo ""
    exit 1
fi

exit 0
