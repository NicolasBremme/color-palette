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

    return [scale(control[0]), scale(control[1])];
}
const precisionDigits = (precision) => { return Math.floor(Math.log10(precision)); }

/* Velocity graph */
var velocityDisplay = document.querySelector("canvas.velocity");
var velocityRect = velocityDisplay.getBoundingClientRect();
var velocitySize = {
    width: velocityDisplay.offsetWidth,
    height: velocityDisplay.offsetHeight
}

/* Colorpicker size */
var colorpickerDisplay = document.querySelector("canvas.spectrum");
var colorPickerRect = colorpickerDisplay.getBoundingClientRect();
var colorPickerSize = {
    width: colorpickerDisplay.offsetWidth,
    height: colorpickerDisplay.offsetHeight
};
var controlSpace = {
    x: 400,
    y: 400
};

/* Color parameters */
var hueInput = document.querySelector(".hue");

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

    document.querySelector(".hue").addEventListener("input", drawPaletteFunction);

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
    hueInput.value = 0;

    colorpickerDisplay.setAttribute("width", colorPickerSize.width);
    colorpickerDisplay.setAttribute("height", colorPickerSize.height);

    velocityDisplay.setAttribute("width", colorPickerSize.width - controlSpace.x);
    velocityDisplay.setAttribute("height", colorPickerSize.height - controlSpace.y);

    point1 = [0, .95];
    point2 = [.95, 0];
    control1 = [1, .65];
    control2 = [.65, 1];

    controlCoord1X.value = control1[0];
    controlCoord1Y.value = control1[1];
    controlCoord2X.value = control2[0];
    controlCoord2Y.value = control2[1];
    pointCoord1X.value = point1[0];
    pointCoord1Y.value = point1[1];
    pointCoord2X.value = point2[0];
    pointCoord2Y.value = point2[1];

    document.querySelectorAll(".coordinate").forEach((element) => {
        let min = 0;
        let max = 1;

        if (element.classList.value.indexOf("control") !== -1) {
            let ratio = (element.dataset.value == 0) ? controlSpace.x / (colorPickerSize.width - controlSpace.x) / 2 : controlSpace.y / (colorPickerSize.height - controlSpace.y) / 2;

            min = Math.min(0, -ratio);
            max = Math.max(1, 1 + ratio);
        }

        element.setAttribute("min", min);
        element.setAttribute("max", max);
    });

    let startPoint1 = normalizedToGraph(point1);
    let startPoint2 =  normalizedToGraph(point2);
    let startControl1 =  normalizedToGraph(control1);
    let startControl2 =  normalizedToGraph(control2);

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
    let sampleStep = Math.round(precision / (parseInt(sampleSize, 10) + 1));

    sampleArray = [];
    for (let i = sampleStep; i <= precision - sampleSize; i += sampleStep) {
        sampleArray.push({"index": i});
    }

    sampleArray.sort((a, b) => {
        return a.index - b.index;
    });
}

function drawPaletteFunction() {
    let context = colorpickerDisplay.getContext("2d");

    let [velocityPoint1, velocityPoint2, velocityControl] = calcVelocityCurveParameters();

    // let startIntegral = cubeBezier(0, point1, point2, control1, control2);
    // let endIntegral = cubeBezier(1, point1, point2, control1, control2);
    // let integral = Math.sqrt(Math.pow(startIntegral[0], 2) + Math.pow(startIntegral[1], 2), 2) + Math.sqrt(Math.pow(endIntegral[0], 2) + Math.pow(endIntegral[1], 2), 2);

    context.clearRect(0, 0, colorPickerSize.width, colorPickerSize.height);
    createColorGradient();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.setLineDash([]);
    context.beginPath();

    let sampleIndexes = sampleArray.map((sampleInfos, index) => {
        return sampleInfos.index;
    });

    for (let i = 0; i <= precision; i++) {
        let iNormalized = i  / precision;
        let [x, y] = cubeBezier(iNormalized, point1, point2, control1, control2);
        // let [x, y] = cubeBezier(iNormalized, point1, point2, applyControlScale(control1), applyControlScale(control2));

        x = Math.max(Math.min(x, 1), 0);
        y = Math.max(Math.min(y, 1), 0);

        let [xGraph, yGraph] = normalizedToGraph([x, y]);

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
    drawVelocityCurve(velocityPoint1, velocityPoint2, velocityControl);
}

function calcVelocityCurveParameters() {
    let p1 = [3 * Math.abs(control1[0] - point1[0]), 3 * Math.abs(control1[1] - point1[1])];
    let p2 = [3 * Math.abs(point2[0] - control2[0]), 3 * Math.abs(point2[1] - control2[1])];
    let c = [3 * Math.abs(control2[0] - control1[0]), 3 * Math.abs(control2[1] - control1[1])];

    return [p1, p2, c];
}

function drawVelocityCurve(velocityPoint1, velocityPoint2, velocityControl) {
    let context = velocityDisplay.getContext("2d");

    // Maximum velocity possible given the constraint of the controls and points coordinates
    // Given by evaluating the derivative of the cubic bezier curve of parameters P1 = [0; 0], P2 = [1; 1], C1 = [1.5; 1.5], C2 = [-0.5; -0.5] at t = 1 / 2
    let upperBound = Math.sqrt(55,125);

    context.clearRect(0, 0, colorPickerSize.width - controlSpace.x, colorPickerSize.height - controlSpace.y);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.setLineDash([]);
    context.beginPath();

    for (let i = 0; i <= precision; i++) {
        let iNormalized = i  / precision;
        let [x, y] = quadBezier(iNormalized, velocityPoint1, velocityPoint2, velocityControl);

        let xRatio = velocitySize.width;
        let yRatio = velocitySize.height / upperBound;

        let velocity = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2), 2);

        let xGraph = iNormalized * xRatio;
        let yGraph = (upperBound - velocity) * yRatio;

        if (i == 0) {
            context.moveTo(xGraph, yGraph);
        }
        context.lineTo(xGraph, yGraph);
    }
    context.stroke();
}

function createColorGradient() {
    let context = colorpickerDisplay.getContext("2d");
    let horizontalGradient = context.createLinearGradient(controlSpace.x / 2, 0, colorPickerSize.width - controlSpace.x / 2, 0);
    let verticalGradient = context.createLinearGradient(0, controlSpace.y / 2, 0, colorPickerSize.height - controlSpace.y / 2);

    horizontalGradient.addColorStop(0, "#ffffff");
    horizontalGradient.addColorStop(1, "hsl(" + hueInput.value + ", 100%, 50%)");
    context.fillStyle = horizontalGradient;
    context.fillRect(controlSpace.x / 2, controlSpace.y / 2, colorPickerSize.width - controlSpace.x, colorPickerSize.height - controlSpace.y);

    verticalGradient.addColorStop(0, "#00000000");
    verticalGradient.addColorStop(1, "#000000");
    context.fillStyle = verticalGradient;
    context.fillRect(controlSpace.x / 2, controlSpace.y / 2, colorPickerSize.width - controlSpace.x, colorPickerSize.height - controlSpace.y);
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

        newPalette.querySelector("div.palette-color").style.backgroundColor = sampleArray[i].hex;
        newPalette.querySelector("p.color-rgb").innerText = "rgb(" + sampleArray[i].rgb[0] + ", " + sampleArray[i].rgb[1] + ", " + sampleArray[i].rgb[2] + ")";
        newPalette.querySelector("p.color-hex").innerText = sampleArray[i].hex;
    }
}

function drawControlToMain() {
    let context = colorpickerDisplay.getContext("2d");

    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.setLineDash([]);
    context.beginPath();
    
    let point1Graph = normalizedToGraph(point1);
    let point2Graph = normalizedToGraph(point2);
    let control1Graph = normalizedToGraph(control1);
    let control2Graph = normalizedToGraph(control2);

    context.moveTo(point1Graph[0], point1Graph[1]);
    context.lineTo(control1Graph[0], control1Graph[1]);

    // context.moveTo(control1Graph[0], control1Graph[1]);
    // context.lineTo(control2Graph[0], control2Graph[1]);

    context.moveTo(point2Graph[0], point2Graph[1]);
    context.lineTo(control2Graph[0], control2Graph[1]);

    context.stroke();
}

function getElementPositionNormalized(position, isNormalized = false) {
    let x = position[0] - controlSpace.x / 2;
    let y = position[1] - controlSpace.y / 2;

    if (isNormalized == false) {
        let xRatio = colorPickerSize.width - controlSpace.x;
        let yRatio = colorPickerSize.height - controlSpace.y;

        x = x / xRatio;
        y = y / yRatio;
    }
    return [(x).toFixed(precisionDigits(precision)), (1 - y).toFixed(precisionDigits(precision))];
}

function normalizedToGraph(position) {
    let xRatio = colorPickerSize.width - controlSpace.x;
    let yRatio = colorPickerSize.height - controlSpace.y;
    let x = position[0] * xRatio + controlSpace.x / 2;
    let y = (1 - position[1]) * yRatio + controlSpace.x / 2;

    return [Math.floor(x), Math.floor(y)];
}

function setCursorPosition(element, position) {
    let x = position[0] + colorPickerRect.left + window.scrollX - xOffset;
    let y = position[1] + colorPickerRect.top + window.scrollY - yOffset;

    element.style.left = x.toString() + "px";
    element.style.top = y.toString() + "px";
}

function moveCursorUser(event)  {
    if (activeCursor == null) {
        return;
    }

    let cursorToMove = activeCursor;
    let position = [event.clientX - colorPickerRect.left, event.clientY - colorPickerRect.top];

    let xPrecisionByPixel = Math.floor((colorPickerSize.width - controlSpace.x) / precision);
    let yPrecisionByPixel = Math.floor((colorPickerSize.height - controlSpace.y) / precision);
    let xPrecisionOffset = 0;
    let yPrecisionOffset = 0;

    if (xPrecisionByPixel > 0) {
        xPrecisionOffset = Math.max(position[0] % xPrecisionByPixel, 0);
    }
    if (yPrecisionByPixel > 0) {
        yPrecisionOffset= Math.max(position[1] % yPrecisionByPixel, 0);
    }

    if (activeCursor.classList.value.indexOf("control") !== -1) {
        position[0] = Math.max(Math.min(position[0] - xPrecisionOffset, colorPickerSize.width), 0);
        position[1] = Math.max(Math.min(position[1] - yPrecisionOffset, colorPickerSize.height), 0);
    }
    if (activeCursor.classList.value.indexOf("point") !== -1) {
        position[0] = Math.max(Math.min(position[0] - xPrecisionOffset, colorPickerSize.width - controlSpace.x / 2), controlSpace.x / 2);
        position[1] = Math.max(Math.min(position[1] - yPrecisionOffset, colorPickerSize.height - controlSpace.y / 2), controlSpace.y / 2);
    }

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

    window[targetSelector][targetValue] = element.value;

    let position = normalizedToGraph(window[targetSelector]);

    setCursorPosition(target, position);

    drawPaletteFunction();
}