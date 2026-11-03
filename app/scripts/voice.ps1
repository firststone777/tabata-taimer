# Genera le clip della voce guida (frasi fisse) con la voce italiana di Windows.
# Le clip vengono suonate con Web Audio, così si mescolano alla musica invece di metterla in pausa.
# Uso: powershell -File scripts/voice.ps1
Add-Type -AssemblyName System.Speech

$out = Join-Path $PSScriptRoot '..\public\voice'
New-Item -ItemType Directory -Force $out | Out-Null

$phrases = [ordered]@{
  via           = 'Via!'
  riposo        = 'Riposo'
  preparati     = 'Preparati'
  riposoLungo   = 'Riposo lungo'
  defaticamento = 'Defaticamento'
  meta          = 'Met' + [char]0xE0  # "Metà": PowerShell 5.1 legge il file come ANSI
  ultimo        = 'Ultimo intervallo!'
  fine          = 'Allenamento completato. Ottimo lavoro!'
}

$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Elsa Desktop')
$s.Rate = 1

foreach ($k in $phrases.Keys) {
  $file = Join-Path $out "$k.wav"
  $s.SetOutputToWaveFile($file, $fmt)
  $s.Speak($phrases[$k])
}
$s.SetOutputToNull()
$s.Dispose()
Get-ChildItem $out | ForEach-Object { "{0} {1:N0} KB" -f $_.Name, ($_.Length / 1KB) }
