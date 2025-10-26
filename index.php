<?php
$planId = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id']) : null;
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Planer układu sali</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app">
        <header class="toolbar">
            <div class="control-group">
                <label for="tableCount">Liczba stołów: <span id="tableCountValue"></span></label>
                <input type="range" id="tableCount" min="4" max="16" step="1">
            </div>
            <div class="control-group">
                <label class="toggle">
                    <input type="checkbox" id="modeToggle">
                    <span>Tryb: <span id="modeLabel">Mniej osób</span></span>
                </label>
            </div>
            <div class="control-group buttons">
                <button id="undoBtn" type="button">Cofnij</button>
                <button id="redoBtn" type="button">Ponów</button>
                <button id="resetBtn" type="button">Reset sali</button>
                <button id="shareBtn" type="button">Udostępnij link do planu stołów</button>
                <label class="toggle">
                    <input type="checkbox" id="gridToggle" checked>
                    <span>Siatka 0,5 m</span>
                </label>
            </div>
        </header>
        <main class="content">
            <aside class="sidebar">
                <section>
                    <h2>Podsumowanie</h2>
                    <p>Stoły: <span id="summaryTables">0</span></p>
                    <p>Goście przypisani: <span id="summaryAssigned">0</span></p>
                    <p>Goście wolni: <span id="summaryUnassigned">0</span></p>
                </section>
                <section class="guest-form">
                    <h2>Lista gości</h2>
                    <form id="guestForm">
                        <input type="text" id="guestName" placeholder="Imię i nazwisko" required>
                        <button type="submit">Dodaj gościa</button>
                    </form>
                    <ul id="guestList" class="guest-list"></ul>
                </section>
                <section id="shareResult" class="share-result hidden"></section>
            </aside>
            <section class="planner">
                <div id="plannerContainer" class="planner-container" data-plan-id="<?php echo htmlspecialchars($planId ?? '', ENT_QUOTES); ?>">
                    <svg id="hallSvg" class="hall" xmlns="http://www.w3.org/2000/svg"></svg>
                    <div id="entitiesLayer" class="entities"></div>
                </div>
            </section>
        </main>
    </div>
    <div id="chairModal" class="modal hidden">
        <div class="modal-content">
            <button type="button" class="modal-close" id="modalClose">×</button>
            <form id="chairForm">
                <label for="chairGuest">Imię i nazwisko</label>
                <input type="text" id="chairGuest" autocomplete="off">
                <div class="modal-actions">
                    <button type="submit">Zapisz</button>
                    <button type="button" id="clearChair">Usuń przypisanie</button>
                </div>
            </form>
        </div>
    </div>
    <script src="script.js" defer></script>
</body>
</html>
