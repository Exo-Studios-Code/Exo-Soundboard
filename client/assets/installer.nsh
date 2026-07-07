; CloudSoundboard NSIS installer helper script
; Umístění: assets/installer.nsh
; Zkontroluje přítomnost VB-Audio Virtual Cable a nabídne instalaci
; =========================================================================

!macro customInstall
  ; Zkontrolujeme registry klíč VB-Audio Virtual Cable
  ReadRegStr $0 HKLM "SOFTWARE\VB-Audio\VoiceMeeter" "UninstallString"
  ReadRegStr $1 HKLM "SYSTEM\CurrentControlSet\Control\Class\{4d36e96c-e325-11ce-bfc1-08002be10318}" "" 
  
  ; Zkusíme najít CABLE Input v audio zařízeních (přes registry)
  ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion\Drivers32" "wave"
  
  ; Jednodušší check: hledáme VBAudioVACMM.inf nebo vbaudio_cable64_win10.inf
  IfFileExists "$WINDIR\INF\vbaudio*.inf" vbcable_found vbcable_missing

  vbcable_found:
    ; VB-Cable nalezen – pokračujeme normálně
    Goto vbcable_done

  vbcable_missing:
    ; VB-Cable nenalezen – zobrazíme dialog
    MessageBox MB_YESNO|MB_ICONINFORMATION \
      "CloudSoundboard potřebuje VB-Audio Virtual Cable pro routování zvuku do Discordu.$\n$\n\
VB-Audio Virtual Cable je ZDARMA a nezbytný pro přehrávání zvuků jako mikrofon v Discordu.$\n$\n\
Chceš nyní otevřít stránku pro stažení VB-Audio Virtual Cable?$\n\
(Instalaci provedeš samostatně před spuštěním aplikace)" \
      IDYES open_vbcable IDNO vbcable_done

  open_vbcable:
    ExecShell "open" "https://vb-audio.com/Cable/index.htm"
    MessageBox MB_OK|MB_ICONINFORMATION \
      "Stránka pro stažení VB-Audio Virtual Cable byla otevřena v prohlížeči.$\n$\n\
Po instalaci VB-Cable:$\n\
1. Restartuj počítač$\n\
2. Spusť CloudSoundboard$\n\
3. V nastavení (ozubené kolečko) vyber 'CABLE Input' jako audio výstup$\n\
4. V Discordu nastav 'CABLE Output' jako vstupní mikrofon"
    Goto vbcable_done

  vbcable_done:
!macroend

!macro customUnInstall
  ; Nic speciálního při odinstalaci
!macroend
