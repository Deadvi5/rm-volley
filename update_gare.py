#!/usr/bin/env python3
"""
Script per scaricare e unire i file Gare.xls da FIPAV
Uso: python update_gare.py
"""

import sys
import os
import subprocess
from pathlib import Path

# Configurazione virtual environment
VENV_DIR = Path(__file__).parent / '.venv'
VENV_PYTHON = VENV_DIR / 'bin' / 'python' if os.name != 'nt' else VENV_DIR / 'Scripts' / 'python.exe'

def create_venv():
    """Crea un virtual environment locale se non esiste"""
    if not VENV_DIR.exists():
        print("🔧 Creazione virtual environment locale...")
        try:
            subprocess.check_call([sys.executable, '-m', 'venv', str(VENV_DIR)])
            print("✅ Virtual environment creato!")
            print()
        except subprocess.CalledProcessError as e:
            print(f"❌ Errore nella creazione del venv: {e}")
            return False
    return True

def install_in_venv(packages):
    """Installa pacchetti nel virtual environment"""
    print(f"📦 Installazione nel venv locale: {', '.join(packages)}")
    try:
        pip_path = VENV_DIR / 'bin' / 'pip' if os.name != 'nt' else VENV_DIR / 'Scripts' / 'pip.exe'
        subprocess.check_call([str(pip_path), 'install', '--quiet'] + packages)
        print("✅ Dipendenze installate!")
        print()
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Errore installazione: {e}")
        return False

def check_and_setup_environment():
    """Verifica dipendenze e configura ambiente se necessario"""
    required_packages = {
        'requests': 'requests',
        'pandas': 'pandas',
        'openpyxl': 'openpyxl',
        'xlrd': 'xlrd',
        'lxml': 'lxml',
        'html5lib': 'html5lib'
    }
    
    # Se siamo già nel venv, verifica solo le dipendenze
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    
    missing_packages = []
    for module_name, package_name in required_packages.items():
        try:
            __import__(module_name)
        except ImportError:
            missing_packages.append(package_name)
    
    # Se mancano pacchetti e non siamo in un venv
    if missing_packages and not in_venv:
        print("⚠️  Dipendenze mancanti rilevate")
        print(f"   Pacchetti necessari: {', '.join(missing_packages)}")
        print()
        
        # Crea venv se non esiste
        if not create_venv():
            print("\n❌ Impossibile creare virtual environment")
            print("\nInstalla manualmente le dipendenze:")
            print(f"  python3 -m venv .venv")
            print(f"  source .venv/bin/activate  # Mac/Linux")
            print(f"  .venv\\Scripts\\activate  # Windows")
            print(f"  pip install {' '.join(missing_packages)}")
            sys.exit(1)
        
        # Installa nel venv
        if not install_in_venv(missing_packages):
            print("\n❌ Impossibile installare le dipendenze")
            sys.exit(1)
        
        # Ri-esegui lo script usando il Python del venv
        print("🔄 Riavvio script con virtual environment...")
        print()
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)
    
    elif missing_packages and in_venv:
        # Siamo già in venv ma mancano pacchetti
        print("📦 Installazione dipendenze mancanti nel venv...")
        if not install_in_venv(missing_packages):
            sys.exit(1)

# Setup ambiente
check_and_setup_environment()

# Ora importa i moduli (dopo la configurazione)
import requests
import pandas as pd
from datetime import datetime
import json

# URLs dei file Excel FIPAV
URLS = [
    'https://www.fipavpiacenza.it/esporta-risultati.aspx?ComitatoId=74&StId=2336&DataDa=&StatoGara=&CId=&SId=3953&PId=9653',
    'https://crer.portalefipav.net/esporta-risultati.aspx?ComitatoId=35&StId=2297&DataDa=&StatoGara=&CId=&SId=3953&PId=29422'
]

LEAGUES = {
    'Serie D Femminile': 'https://crer.portalefipav.net/classifica.aspx?CId=84906',
    'Seconda Div. F Gir. C': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85893',
    'Seconda Div. F Gir. E': 'https://www.fipavpiacenza.it/classifica.aspx?CId=87068',
    'Under 18 F Gir. A': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85960',
    'Under 16 F Gir. A': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85962',
    'Under 16 F Gir. B': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85963',
    'Under 14 F Gir. A': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85965',
    'Under 14 F Gir. C': 'https://www.fipavpiacenza.it/classifica.aspx?CId=85968',
    'Under 14 F Gir. D': 'https://www.fipavpiacenza.it/classifica.aspx?CId=86960',
    'Under 14 F Gir. E': 'https://www.fipavpiacenza.it/classifica.aspx?CId=86961'
}

OUTPUT_FILE = 'Gare.xls'
CLASSIFICA_FILE = 'classifica.json'

def download_excel(url, filename):
    """Scarica un file Excel dall'URL specificato"""
    try:
        print(f"📥 Download in corso da: {url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.ms-excel, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': url.split('/esporta')[0]
        }
        
        response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        response.raise_for_status()
        
        # Verifica che sia un file Excel valido
        content_type = response.headers.get('Content-Type', '')
        if 'excel' not in content_type.lower() and 'octet-stream' not in content_type.lower():
            print(f"⚠️  Warning: Content-Type inaspettato: {content_type}")
        
        # Salva il file
        with open(filename, 'wb') as f:
            f.write(response.content)
        
        file_size = len(response.content)
        print(f"✅ File scaricato: {filename} ({file_size:,} bytes)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Errore durante il download: {e}")
        return False
    except Exception as e:
        print(f"❌ Errore inaspettato: {e}")
        return False

def merge_excel_files(files, output_file):
    """Unisce più file Excel in uno solo"""
    try:
        print(f"\n🔄 Unione dei file in corso...")
        
        all_data = []
        
        for i, file in enumerate(files):
            if not os.path.exists(file):
                print(f"⚠️  File non trovato: {file}")
                continue
                
            try:
                # Prova a leggere con diversi engine
                try:
                    df = pd.read_excel(file, engine='xlrd')
                except:
                    # Converti a xlsx se necessario
                    import subprocess
                    temp_xlsx = file.replace('.xls', '_temp.xlsx')
                    subprocess.run(['libreoffice', '--headless', '--convert-to', 'xlsx', file], 
                                 capture_output=True)
                    df = pd.read_excel(temp_xlsx, engine='openpyxl')
                    os.remove(temp_xlsx)
                
                print(f"  ✓ Letto {file}: {len(df)} righe, {len(df.columns)} colonne")
                all_data.append(df)
                
            except Exception as e:
                print(f"  ✗ Errore nella lettura di {file}: {e}")
                continue
        
        if not all_data:
            print("❌ Nessun dato da unire!")
            return False
        
        # Unisci tutti i dataframe
        merged_df = pd.concat(all_data, ignore_index=True)
        
        # Rimuovi eventuali duplicati (stessa Gara N)
        if 'Gara N' in merged_df.columns:
            initial_rows = len(merged_df)
            merged_df = merged_df.drop_duplicates(subset=['Gara N'], keep='first')
            duplicates_removed = initial_rows - len(merged_df)
            if duplicates_removed > 0:
                print(f"  ℹ️  Rimossi {duplicates_removed} duplicati")
        
        # Ordina per data se presente
        if 'Data' in merged_df.columns:
            merged_df['Data_Sort'] = pd.to_datetime(merged_df['Data'], format='%d/%m/%Y', errors='coerce')
            merged_df = merged_df.sort_values('Data_Sort')
            merged_df = merged_df.drop('Data_Sort', axis=1)
        
        # Salva il file unito
        merged_df.to_excel(output_file, index=False, engine='openpyxl')
        
        print(f"\n✅ File unito creato: {output_file}")
        print(f"   📊 Totale righe: {len(merged_df)}")
        print(f"   📊 Totale colonne: {len(merged_df.columns)}")
        print(f"   📊 Dimensione: {os.path.getsize(output_file):,} bytes")
        
        return True
        
    except Exception as e:
        print(f"❌ Errore durante l'unione: {e}")
        import traceback
        traceback.print_exc()
        return False

def update_classifica():
    """Scarica e aggiorna le classifiche"""
    print(f"\n🏆 Aggiornamento classifiche...")
    
    all_standings = {}
    
    for league_name, url in LEAGUES.items():
        print(f"  ⏳ Scaricamento {league_name}...")
        try:
            # Leggi le tabelle dalla pagina
            dfs = pd.read_html(url)
            
            if not dfs:
                print(f"    ❌ Nessuna tabella trovata per {league_name}")
                continue
                
            # La classifica è solitamente la prima tabella o quella con colonne specifiche
            classifica_df = None
            for df in dfs:
                # Normalizza i nomi delle colonne
                cols = [str(c).lower() for c in df.columns]
                if any('squadra' in c for c in cols) and any('punti' in c for c in cols):
                    classifica_df = df
                    break
            
            if classifica_df is None:
                classifica_df = dfs[0]
                
            # Pulisci i dati
            classifica_df = classifica_df.dropna(axis=1, how='all')
            
            # Converti in lista di dizionari
            records = classifica_df.to_dict('records')
            all_standings[league_name] = records
            print(f"    ✅ OK: {len(records)} squadre")
            
        except Exception as e:
            print(f"    ❌ Errore: {e}")
    
    try:
        # Salva in JSON
        with open(CLASSIFICA_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_standings, f, ensure_ascii=False, indent=2)
            
        print(f"\n✅ Tutte le classifiche salvate in: {CLASSIFICA_FILE}")
        print(f"   📊 Campionati: {len(all_standings)}")
        return True
        
    except Exception as e:
        print(f"❌ Errore salvataggio JSON: {e}")
        return False

def cleanup_temp_files(files):
    """Rimuove i file temporanei"""
    for file in files:
        try:
            if os.path.exists(file):
                os.remove(file)
        except Exception as e:
            print(f"⚠️  Impossibile rimuovere {file}: {e}")

def main():
    """Funzione principale"""
    print("=" * 60)
    print("  RM Volley - Aggiornamento Dati Partite")
    print("=" * 60)
    print(f"  Data/Ora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # File temporanei
    temp_files = [f'Gare_temp_{i+1}.xls' for i in range(len(URLS))]
    
    # Download dei file
    success_count = 0
    for i, url in enumerate(URLS):
        print(f"\n[{i+1}/{len(URLS)}] Download file...")
        if download_excel(url, temp_files[i]):
            success_count += 1
    
    if success_count == 0:
        print("\n❌ Nessun file scaricato con successo!")
        print("   Verifica la connessione internet e gli URL")
        return 1
    
    print(f"\n✓ Scaricati {success_count}/{len(URLS)} file")
    
    # Unione dei file
    if merge_excel_files(temp_files, OUTPUT_FILE):
        print(f"\n🎉 Aggiornamento partite completato con successo!")
        print(f"   File pronto: {OUTPUT_FILE}")
        
        # Backup del file precedente
        if os.path.exists(OUTPUT_FILE):
            backup_name = f"Gare_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xls"
            try:
                import shutil
                # Non fare backup se è appena stato creato
                if os.path.exists(f"{OUTPUT_FILE}.old"):
                    shutil.copy2(f"{OUTPUT_FILE}.old", backup_name)
                    print(f"   💾 Backup creato: {backup_name}")
            except:
                pass
    else:
        print("\n❌ Errore durante l'unione dei file")
        return 1
    
    # Aggiornamento classifica
    update_classifica()
    
    # Pulizia file temporanei
    cleanup_temp_files(temp_files)
    
    print("\n" + "=" * 60)
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Operazione annullata dall'utente")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Errore fatale: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)