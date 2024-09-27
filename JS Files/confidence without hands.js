
        const videoElement = document.getElementById('input_video');
        const canvasElement = document.getElementById('output_canvas');
        const canvasCtx = canvasElement.getContext('2d');
        const confidenceScoreElement = document.getElementById('confidence_score');
        const startButton = document.getElementById('startButton');
        const stopButton = document.getElementById('stopButton');

        let totalConfidence = 0;
        let frameCount = 0;
        let lastFacePosition = null;
        let lastLipMovementTime = Date.now();  
        let lastBlinkTime = Date.now();
        let running = false;  // To track if the system is running or not
        const lipStillThreshold = 5000;
        const blinkThreshold = 15;  // 15 blinks per minute threshold

        const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
        const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
        const MOUTH_INDICES = [78, 95, 191, 81, 13, 311, 308, 415, 402, 318];

        function startRecording() {
            running = true;
            startButton.disabled = true;
            stopButton.disabled = false;
            camera.start();
        }

        function stopRecording() {
            running = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            camera.stop();  // Stops the camera feed
        }

        // Add event listeners to start and stop buttons
        startButton.addEventListener('click', startRecording);
        stopButton.addEventListener('click', stopRecording);

        // Analyze blink rate and apply confidence decrease
        function analyzeBlinkConfidence(landmarks) {
            const blinkDuration = Date.now() - lastBlinkTime;
            if (blinkDuration < 60000 / blinkThreshold) {  
                return 0.4;  
            }
            lastBlinkTime = Date.now();
            return 1;
        }

        // Analyze smiling and increase confidence
        function analyzeSmileConfidence(landmarks) {
            const mouthWidth = calculateDistance(landmarks, 78, 95);
            const mouthHeight = calculateDistance(landmarks, 13, 81);
            const mouthAspectRatio = mouthWidth / mouthHeight;
            const smileThreshold = 1.5;
            return mouthAspectRatio > smileThreshold ? 1.2 : 0.6;  
        }

        // Detect lip movement and apply mouth shut duration logic
        function analyzeLipConfidence(landmarks) {
            const lipDistance = calculateDistance(landmarks, 13, 14);
            if (lipDistance >= 0.02) {
                lastLipMovementTime = Date.now();
                return 1;  
            } else {
                if (Date.now() - lastLipMovementTime > lipStillThreshold) {
                    return 0.4;  
                }
            }
            return 1;
        }

        // Detect face movement frequency and decrease confidence if too frequent
        function analyzeMovementConfidence(landmarks) {
            if (lastFacePosition) {
                const currentPosition = getCenterOfLandmarks(landmarks, LEFT_EYE_INDICES.concat(RIGHT_EYE_INDICES));
                const dx = currentPosition.x - lastFacePosition.x;
                const dy = currentPosition.y - lastFacePosition.y;
                const movement = Math.sqrt(dx * dx + dy * dy);
                lastFacePosition = currentPosition;
                return movement < 0.05 ? 1 : 0.4; 
            }
            lastFacePosition = getCenterOfLandmarks(landmarks, LEFT_EYE_INDICES.concat(RIGHT_EYE_INDICES));
            return 1;
        }

        // Analyze head movement and apply confidence adjustments based on yaw, pitch, and roll
        function analyzeHeadPose(landmarks) {
            const yaw = Math.abs(landmarks.yaw);
            const pitch = Math.abs(landmarks.pitch);
            const roll = Math.abs(landmarks.roll);
            return (yaw > 10 || pitch > 10 || roll > 10) ? 0.4 : 1;
        }

        function calculateDistance(landmarks, index1, index2) {
            const dx = landmarks[index1].x - landmarks[index2].x;
            const dy = landmarks[index1].y - landmarks[index2].y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function getCenterOfLandmarks(landmarks, indices) {
            let x = 0, y = 0;
            indices.forEach(index => {
                x += landmarks[index].x;
                y += landmarks[index].y;
            });
            return {x: x / indices.length, y: y / indices.length};
        }

        // Initialize face detection, hand detection, and camera setup
        const faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        faceMesh.onResults(onFaceMeshResults);

        const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        hands.onResults(onHandsResults);

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (running) {
                    await faceMesh.send({image: videoElement});
                    await hands.send({image: videoElement});
                }
            },
            width: 640,
            height: 480
        });

        function onFaceMeshResults(results) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            if (results.multiFaceLandmarks) {
                for (const landmarks of results.multiFaceLandmarks) {
                    drawLandmarks(landmarks, 'blue');

                    let smileConfidence = analyzeSmileConfidence(landmarks);
                    let movementConfidence = analyzeMovementConfidence(landmarks);
                    let lipConfidence = analyzeLipConfidence(landmarks);
                    let blinkConfidence = analyzeBlinkConfidence(landmarks);
                    let headPoseConfidence = analyzeHeadPose(landmarks);

                    // Calculate total confidence for this frame
                    let frameConfidence = (smileConfidence + movementConfidence + lipConfidence + blinkConfidence + headPoseConfidence) / 5;
                    totalConfidence += frameConfidence;
                    frameCount++;

                    // Display confidence score
                    confidenceScoreElement.innerText = ((totalConfidence / frameCount) * 100).toFixed(2) + '%';

                    // Log individual confidence factors to console
                    console.log('Smile Confidence:', smileConfidence);
                    console.log('Movement Confidence:', movementConfidence);
                    console.log('Lip Confidence:', lipConfidence);
                    console.log('Blink Confidence:', blinkConfidence);
                    console.log('Head Pose Confidence:', headPoseConfidence);
                    console.log('Frame Confidence:', frameConfidence);
                }
            }
        }

        function onHandsResults(results) {
            if (results.multiHandLandmarks) {
                for (const landmarks of results.multiHandLandmarks) {
                    drawLandmarks(landmarks, 'red');
                }
            }
        }

        function drawLandmarks(landmarks, color) {
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 1;
            for (let i = 0; i < landmarks.length; i++) {
                const x = landmarks[i].x * canvasElement.width;
                const y = landmarks[i].y * canvasElement.height;
                canvasCtx.moveTo(x, y);
                canvasCtx.arc(x, y, 1, 0, 2 * Math.PI);
            }
            canvasCtx.stroke();
        }
    