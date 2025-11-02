<?php
$planId = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id']) : null;
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Planer układu sali</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='8' ry='8' fill='%232b1b0f'/%3E%3Ctext x='32' y='40' font-size='32' text-anchor='middle' fill='%23f2d2a9' font-family='Arial,Helvetica,sans-serif'%3ESP%3C/text%3E%3C/svg%3E">
    <link rel="stylesheet" href="css/base.css">
    <link rel="stylesheet" href="css/layout.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/modals.css">
</head>
<body>
    <div class="app">
        <header class="toolbar">
            <div class="control-group">
                <label for="tableCount">Liczba stołów: <span id="tableCountValue"></span></label>
                <input type="range" id="tableCount" min="4" max="18" step="1">
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
                    <p>Miejsca łącznie: <span id="summarySeatsTotal">0</span></p>
                    <p>Miejsca wolne: <span id="summarySeatsFree">0</span></p>
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
    <div id="tableModal" class="modal hidden">
        <div class="modal-content">
            <button type="button" class="modal-close" id="tableModalClose">×</button>
            <form id="tableForm">
                <label for="tableDescription">Opis stołu</label>
                <textarea id="tableDescription" placeholder="Opcjonalny opis stołu"></textarea>
                <label for="tableRotation">Orientacja stołu</label>
                <select id="tableRotation">
                    <option value="0">Poziomo (dłuższy bok w poziomie)</option>
                    <option value="90">Pionowo (dłuższy bok w pionie)</option>
                </select>
                <label class="checkbox-field">
                    <input type="checkbox" id="tableHead">
                    <span>Stół prezydialny (krzesła po jednej stronie)</span>
                </label>
                <div class="conditional-field hidden" id="tableHeadSeatsField">
                    <label for="tableHeadSeats">Liczba miejsc przy stole prezydialnym</label>
                    <select id="tableHeadSeats">
                        <option value="2">2 miejsca</option>
                        <option value="3">3 miejsca</option>
                        <option value="4">4 miejsca</option>
                    </select>
                </div>
                <label for="tableShortSides">Krzesła na krótszych bokach</label>
                <select id="tableShortSides">
                    <option value="none">Brak</option>
                    <option value="single">Krzesło na jednym boku</option>
                    <option value="both">Krzesła na obu bokach</option>
                </select>
                <div class="modal-actions">
                    <button type="submit">Zapisz</button>
                    <button type="button" id="tableModalCancel">Anuluj</button>
                    <button type="button" id="tableDeleteBtn" class="danger">🗑 Usuń stół</button>
                </div>
            </form>
        </div>
    </div>
    <script type="module" src="js/main.js"></script>
</body>
</html>
