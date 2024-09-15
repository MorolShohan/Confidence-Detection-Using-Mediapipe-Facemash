const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// Function to handle results from the Face Mesh model
function onFaceMeshResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            // Draw facial landmarks (468 points)
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});

            // Get specific eye and lip landmarks
            const leftEye = [33, 133];  // Indices for left eye points
            const rightEye = [362, 263]; // Indices for right eye points
            const upperLip = [13]; // Index for upper lip
            const lowerLip = [14]; // Index for lower lip

            // Draw custom eye landmarks
            leftEye.forEach(index => drawLandmark(canvasCtx, landmarks[index], '#FF0000'));
            rightEye.forEach(index => drawLandmark(canvasCtx, landmarks[index], '#0000FF'));

            // Draw custom lip landmarks
            upperLip.forEach(index => drawLandmark(canvasCtx, landmarks[index], '#00FF00'));
            lowerLip.forEach(index => drawLandmark(canvasCtx, landmarks[index], '#00FF00'));

            // Detect winks or eye movements based on landmark positions
            detectEyeBlink(landmarks);

            // Detect lip movements
            detectLipMovement(landmarks);
        }
    }
    canvasCtx.restore();
}

// Helper function to draw landmarks
function drawLandmark(ctx, landmark, color) {
    ctx.beginPath();
    ctx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 3, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

// Detect eye blink by comparing vertical distances of the eye points
function detectEyeBlink(landmarks) {
    const leftEyeTop = landmarks[159];  // Left eye top point
    const leftEyeBottom = landmarks[145];  // Left eye bottom point
    const rightEyeTop = landmarks[386];  // Right eye top point
    const rightEyeBottom = landmarks[374];  // Right eye bottom point

    const leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);

    if (leftEyeOpen < 0.02) {
        console.log("Left eye wink detected");
    }
    if (rightEyeOpen < 0.02) {
        console.log("Right eye wink detected");
    }
}

// Detect lip movement by comparing upper and lower lip distances
function detectLipMovement(landmarks) {
    const upperLip = landmarks[13];  // Upper lip point
    const lowerLip = landmarks[14];  // Lower lip point

    const lipDistance = Math.abs(upperLip.y - lowerLip.y);
    if (lipDistance > 0.05) {
        console.log("Mouth open");
    } else {
        console.log("Mouth closed");
    }
}

// Load Face Mesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onFaceMeshResults);

// Setup webcam
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();
