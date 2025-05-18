const HSBToRGB = (h, s, b) => {
    const k = (n) => (n + h / 60) % 6;
    const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));

    let red = Math.round(255 * f(5));
    let green = Math.round(255 * f(3));
    let blue = Math.round(255 * f(1));

    return [Math.max(0, Math.min(255, red)), Math.max(0, Math.min(255, green)), Math.max(0, Math.min(255, blue))];
};
var componentToHex = (c) => {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}
var rgbToHex = (r, g, b) => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
const lerp = (x, y, a) => x * (1 - a) + y * a;
const quadBezier = (t, start, end, control) => {
    let x = [lerp(start[0], control[0], t), lerp(control[0], end[0], t)];
    let y = [lerp(start[1], control[1], t), lerp(control[1], end[1], t)];

    return [lerp(x[0], x[1], t), lerp(y[0], y[1], t)];
}
const cubeBezier = (t, start, end, control1, control2) => {
    let stepPoint1 = quadBezier(t, start, end, control1);
    let stepPoint2 = quadBezier(t, start, end, control2);

    return [lerp(stepPoint1[0], stepPoint2[0], t), lerp(stepPoint1[1], stepPoint2[1], t)];
}
const applyControlScale = (control) => {
    let scale = (n) => { return 2.5 * (n - .5) + .5; }

    return control;
    return [scale(control[0]), scale(control[1])];
}
const precisionDigits = (precision) => { return Math.floor(Math.log10(precision)); }

var colorpickerDisplay = document.querySelector(".colorpicker canvas");
var displayRect = colorpickerDisplay.getBoundingClientRect();
var displaySize = {
    width: colorpickerDisplay.offsetWidth,
    height: colorpickerDisplay.offsetHeight
}

/* Cursors */
var controlCursor1 = document.querySelector(".controlCursor[data-position='control1']");
var controlCursor2 = document.querySelector(".controlCursor[data-position='control2']");
var pointCursor1 = document.querySelector(".pointCursor[data-position='point1']");
var pointCursor2 = document.querySelector(".pointCursor[data-position='point2']");

/* Input number coord */
var controlCoord1X = document.querySelector(".coordinate[data-target='control1'][data-value='0']");
var controlCoord1Y = document.querySelector(".coordinate[data-target='control1'][data-value='1']");
var controlCoord2X = document.querySelector(".coordinate[data-target='control2'][data-value='0']");
var controlCoord2Y = document.querySelector(".coordinate[data-target='control2'][data-value='1']");
var pointCoord1X = document.querySelector(".coordinate[data-target='point1'][data-value='0']");
var pointCoord1Y = document.querySelector(".coordinate[data-target='point1'][data-value='1']");
var pointCoord2X = document.querySelector(".coordinate[data-target='point2'][data-value='0']");
var pointCoord2Y = document.querySelector(".coordinate[data-target='point2'][data-value='1']");

/* Stored normalized position */
var control1 = null;
var control2 = null;
var point1 = null;
var point2 = null;

var sampleSizeInput = document.querySelector(".sample-size");
var sampleArray = [];

var activeCursor = null;
var xOffset = Math.floor(controlCursor1.offsetWidth / 2);
var yOffset = Math.floor(controlCursor1.offsetHeight / 2);

var precision = 100;

setup();
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".controlCursor, .pointCursor").forEach((element) => {
        element.addEventListener("mousedown", (event) => {
            let element = event.currentTarget;

            if (activeCursor !== null) {
                return;
            }

            activeCursor = element;
        });
    });

    window.addEventListener("mouseup", (event) => {
        activeCursor = null;
    });

    window.addEventListener("mousemove", moveCursorUser);

    document.querySelector(".hue").addEventListener("input", (event) => {
        let element = event.currentTarget;
        let value = element.value;
        let spectrum = document.querySelector(".spectrum");

        spectrum.style.backgroundColor = "hsl(" + value + ", 100%, 50%)";

        drawPaletteFunction();
    });

    document.querySelectorAll(".coordinate").forEach((element) => {
        element.addEventListener("input", onInputCoordinateNumber);
    });

    sampleSizeInput.addEventListener("input", (event) => {
        let element = event.currentTarget;
        let max = parseInt(element.getAttribute("max"), 10);
        let min = parseInt(element.getAttribute("min"), 10);

        if (max !== null && element.value > max) {
            element.value = max;
        }

        if (min !== null && element.value < min) {
            element.value = min;
        }

        createSampleArray(element.value);

        drawPaletteFunction();
    });
});

function setup() {
    let spectrum = document.querySelector(".spectrum");
    let hue = document.querySelector(".hue");

    spectrum.style.backgroundColor = "red";
    hue.value = 0;

    colorpickerDisplay.setAttribute("width", displaySize.width);
    colorpickerDisplay.setAttribute("height", displaySize.height);

    point1 = [0, .95];
    point2 = [.95, 0];
    control1 = [1, .65];
    control2 = [.65, 1];

    let xRatio = displaySize.width;
    let yRatio = displaySize.height;

    let startPoint1 = [point1[0] * xRatio, (displaySize.height - point1[1] * yRatio)];
    let startPoint2 = [point2[0] * xRatio, (displaySize.height - point2[1] * yRatio)];
    let startControl1 = [control1[0] * xRatio, (displaySize.height - control1[1] * yRatio)];
    let startControl2 = [control2[0] * xRatio, (displaySize.height - control2[1] * yRatio)];

    point1 = getElementPositionNormalized(startPoint1);
    point2 = getElementPositionNormalized(startPoint2);
    control1 = getElementPositionNormalized(startControl1);
    control2 = getElementPositionNormalized(startControl2);

    controlCoord1X.value = control1[0];
    controlCoord1Y.value = control1[1];
    controlCoord2X.value = control2[0];
    controlCoord2Y.value = control2[1];
    pointCoord1X.value = point1[0];
    pointCoord1Y.value = point1[1];
    pointCoord2X.value = point2[0];
    pointCoord2Y.value = point2[1];

    document.querySelectorAll(".coordinate").forEach((element) => {
        element.setAttribute("min", 0);
        element.setAttribute("max", 1);
    });

    setCursorPosition(controlCursor1, startControl1);
    setCursorPosition(controlCursor2, startControl2);
    setCursorPosition(pointCursor1, startPoint1);
    setCursorPosition(pointCursor2, startPoint2);
    
    document.querySelectorAll(".coordinate").forEach((element) => {
        element.setAttribute("step", 1 / Math.pow(10, precisionDigits(precision)));
    });
    
    sampleSizeInput.value = 1;
    createSampleArray(sampleSizeInput.value);

    drawPaletteFunction();
}

function createSampleArray(sampleSize) {
    let sampleStep = Math.round(precision / sampleSize);
    let middleOffset = 0;

    sampleArray = [];
    if (sampleSize % 2 == 0) {
        middleOffset = Math.floor(sampleStep / 2);
    }

    for (let i = 0; i < precision / 2; i += sampleStep) {
        let aboveIndex = Math.floor(precision / 2 + i) + middleOffset;
        let belowIndex = Math.floor(precision / 2 - i) - middleOffset;

        sampleArray.push({"index": aboveIndex});
        if (belowIndex != aboveIndex) {
            sampleArray.push({"index": belowIndex});
        }
    }

    sampleArray.sort((a, b) => {
        return a.index - b.index;
    });
}

function drawPaletteFunction() {
    let context = colorpickerDisplay.getContext("2d");

    context.clearRect(0, 0, displaySize.width, displaySize.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.setLineDash([]);
    context.beginPath();

    let xRatio = displaySize.width;
    let yRatio = displaySize.height;

    let scaledControl1 = applyControlScale(control1);
    let scaledControl2 = applyControlScale(control2);

    let sampleIndexes = sampleArray.map((sampleInfos, index) => {
        return sampleInfos.index;
    });

    for (let i = 0; i <= precision; i++) {
        let iNormalized = i  / precision;
        let [x, y] = cubeBezier(iNormalized, point1, point2, scaledControl1, scaledControl2);

        let xGraph = x * xRatio;
        let yGraph = displaySize.height - y * yRatio;

        if (i == 0) {
            context.moveTo(xGraph, yGraph);
        }
        context.lineTo(xGraph, yGraph);

        let indexInSampleArray = sampleIndexes.indexOf(i);
        if (indexInSampleArray !== -1) {
            let hue = document.querySelector(".hue").value;
            let rgb = HSBToRGB(hue, x, y);
            let hex = rgbToHex(rgb[0], rgb[1], rgb[2]);

            sampleArray[indexInSampleArray]["rgb"] = rgb;
            sampleArray[indexInSampleArray]["hex"] = hex;

            context.stroke();
            context.beginPath();
            context.arc(xGraph, yGraph, 5, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            context.moveTo(xGraph, yGraph);
        }
    }
    context.stroke();

    drawControlToMain();
    createColorPalette();
}

function createColorPalette() {
    let colorPalette = document.querySelectorAll(".palette");
    let firstPalette = colorPalette[0];

    colorPalette.forEach((element, index) => {
        if (index != 0) {
            element.remove();
        }
    });

    firstPalette.querySelector("div.palette-color").style.backgroundColor = sampleArray[0].hex;
    firstPalette.querySelector("p.color-rgb").innerText = "rgb(" + sampleArray[0].rgb[0] + ", " + sampleArray[0].rgb[1] + ", " + sampleArray[0].rgb[2] + ")"
    firstPalette.querySelector("p.color-hex").innerText = sampleArray[0].hex

    for (let i = 1; i < sampleArray.length; i++) {
        let newPalette = firstPalette.cloneNode(true);
        let parentNode = document.querySelector(".palette-container");

        newPalette.setAttribute("data-index", i);
        parentNode.append(newPalette);

        newPalette = document.querySelector(".palette[data-index='" + i + "']");
        console.log(i, newPalette)

        newPalette.querySelector("div.palette-color").style.backgroundColor = sampleArray[i].hex;
        newPalette.querySelector("p.color-rgb").innerText = "rgb(" + sampleArray[0].rgb[0] + ", " + sampleArray[0].rgb[1] + ", " + sampleArray[0].rgb[2] + ")";
        newPalette.querySelector("p.color-hex").innerText = sampleArray[0].hex;
    }
}

function drawControlToMain() {
    let context = colorpickerDisplay.getContext("2d");

    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.setLineDash([]);
    context.beginPath();

    let xRatio = displaySize.width;
    let yRatio = displaySize.height;

    context.moveTo(point1[0] * xRatio, displaySize.height - point1[1] * yRatio);
    context.lineTo(control1[0] * xRatio, displaySize.height - control1[1] * yRatio);

    context.moveTo(control1[0] * xRatio, displaySize.height - control1[1] * yRatio);
    context.lineTo(control2[0] * xRatio, displaySize.height - control2[1] * yRatio);
    
    context.moveTo(point2[0] * xRatio, displaySize.height - point2[1] * yRatio);
    context.lineTo(control2[0] * xRatio, displaySize.height - control2[1] * yRatio);

    context.stroke();
}

function getElementPositionNormalized(position, isNormalized = false) {
    let x = position[0];
    let y = position[1];

    if (isNormalized == false) {
        let xRatio = displaySize.width;
        let yRatio = displaySize.height;

        x = x / xRatio;
        y = y / yRatio;
    }
    return [(x).toFixed(precisionDigits(precision)), (1 - y).toFixed(precisionDigits(precision))];
}

function setCursorPosition(element, position) {
    let x = position[0] + displayRect.left + window.scrollX - xOffset;
    let y = position[1] + displayRect.top + window.scrollY - yOffset;

    element.style.left = x.toString() + "px";
    element.style.top = y.toString() + "px";
}

function moveCursorUser(event)  {
    if (activeCursor == null) {
        return;
    }

    let cursorToMove = activeCursor;
    let position = [event.clientX - displayRect.left, event.clientY - displayRect.top];

    let xPrecisionByPixel = Math.floor(displaySize.width / precision);
    let yPrecisionByPixel = Math.floor(displaySize.height / precision);
    let xPrecisionOffset = 0;
    let yPrecisionOffset = 0;

    if (xPrecisionByPixel > 0) {
        xPrecisionOffset = Math.max(position[0] % xPrecisionByPixel, 0);
    }
    if (yPrecisionByPixel > 0) {
        yPrecisionOffset= Math.max(position[1] % yPrecisionByPixel, 0);
    }

    position[0] = Math.max(Math.min(position[0] - xPrecisionOffset, displaySize.width), 0);
    position[1] = Math.max(Math.min(position[1] - yPrecisionOffset, displaySize.height), 0);

    window[cursorToMove.dataset.position] = getElementPositionNormalized(position);
    setCursorPosition(cursorToMove, position);

    let numberInput = document.querySelectorAll(".coordinate[data-target='" + activeCursor.dataset.position + "']");

    for (let i = 0; i < numberInput.length; i++) {
        numberInput[i].value = window[cursorToMove.dataset.position][i];
    }

    drawPaletteFunction();
}

function onInputCoordinateNumber(event) {
    let element = event.currentTarget;
    let targetSelector = element.dataset.target;
    let targetValue = element.dataset.value;
    let target = document.querySelector(".cursor[data-position='" + targetSelector + "']");
    let max = parseFloat(element.getAttribute("max"));
    let min = parseFloat(element.getAttribute("min"));

    if (max !== null && element.value > max) {
        element.value = max;
    }

    if (min !== null && element.value < min) {
        element.value = min;
    }

    let xRatio = displaySize.width;
    let yRatio = displaySize.height;
    
    window[targetSelector][targetValue] = element.value;

    let position = [window[targetSelector][0] * xRatio, displaySize.height - window[targetSelector][1] * yRatio];

    setCursorPosition(target, position);

    drawPaletteFunction();
}