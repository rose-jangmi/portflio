$prefix = 'http://localhost:8765/'
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Port 8765 could not be opened. Close any process using the port and try again." -ForegroundColor Red
    exit 1
}

Write-Host "JANG MI Portfolio: $prefix"
Start-Process $prefix

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $relative = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
    $path = Join-Path $root ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('404 - File not found')
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
        $mime = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.svg'='image/svg+xml'; '.pdf'='application/pdf' }
        $response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($path)
        $response.StatusCode = 200
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }

    $response.Close()
}
