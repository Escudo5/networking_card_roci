/**
 * Rocío Hernández - Networking Card (MaaL)
 * Client-side script: Canvas background, Web Audio API synth, and visual interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       1. GLOBAL STATE & CONFIG
       ========================================================================== */
    let audioCtx = null;
    let synthDelayNode = null;
    let synthDelayFeedback = null;
    let synthAnalyser = null;
    let isSynthInitialized = false;

    // Frequencies mapping for standard musical notes
    const noteFrequencies = {
        'C4': 261.63, // DO
        'E4': 329.63, // MI
        'G4': 392.00, // SOL
        'B4': 493.88, // SI
        'C5': 523.25, // DO+
        'E5': 659.25  // MI+
    };

    // Tone color pad references for triggers
    const padClasses = {
        'C4': '#ff007f',
        'E4': '#9b51e0',
        'G4': '#2f80ed',
        'B4': '#00f2fe',
        'C5': '#27ae60',
        'E5': '#f2c94c'
    };

    /* ==========================================================================
       2. INTERACTIVE CANVAS BACKGROUND
       ========================================================================== */
    const bgCanvas = document.getElementById('bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    
    let particles = [];
    let mouse = { x: null, y: null, radius: 120 };
    let excitementLevel = 0; // Increases on audio click, decays over time

    // Resize Canvas
    function resizeBgCanvas() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }
    resizeBgCanvas();
    window.addEventListener('resize', resizeBgCanvas);

    // Track Mouse
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    
    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Particle Blueprint
    class SoundParticle {
        constructor() {
            this.x = Math.random() * bgCanvas.width;
            this.y = Math.random() * bgCanvas.height;
            this.baseSize = Math.random() * 2 + 1;
            this.size = this.baseSize;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.color = Math.random() > 0.5 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(127, 0, 255, 0.12)';
        }

        update() {
            this.x += this.speedX * (1 + excitementLevel * 5);
            this.y += this.speedY * (1 + excitementLevel * 5);
            
            // Screen Wrapping
            if (this.x < 0) this.x = bgCanvas.width;
            if (this.x > bgCanvas.width) this.x = 0;
            if (this.y < 0) this.y = bgCanvas.height;
            if (this.y > bgCanvas.height) this.y = 0;

            // Mouse Interaction (Pushing particles away softly)
            if (mouse.x !== null && mouse.y !== null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius) {
                    let forceDirectionX = dx / distance;
                    let forceDirectionY = dy / distance;
                    let maxForce = (mouse.radius - distance) / mouse.radius;
                    let force = maxForce * 0.8;
                    
                    this.x -= forceDirectionX * force;
                    this.y -= forceDirectionY * force;
                }
            }

            // Synthesizer excitement adjustments
            this.size = this.baseSize + (excitementLevel * 3);
        }

        draw() {
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            bgCtx.fillStyle = this.color;
            if (excitementLevel > 0.1) {
                bgCtx.shadowBlur = excitementLevel * 10;
                bgCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
            } else {
                bgCtx.shadowBlur = 0;
            }
            bgCtx.fill();
        }
    }

    // Populate Particles
    function initBgParticles() {
        particles = [];
        const particleCount = Math.min(Math.floor(window.innerWidth / 12), 120);
        for (let i = 0; i < particleCount; i++) {
            particles.push(new SoundParticle());
        }
    }
    initBgParticles();
    window.addEventListener('resize', initBgParticles);

    // Particle Animation Loop
    function animateParticles() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        
        // Background Gradient Glow
        bgCtx.fillStyle = bgCtx.createRadialGradient(
            bgCanvas.width / 2, bgCanvas.height / 2, 0,
            bgCanvas.width / 2, bgCanvas.height / 2, bgCanvas.width
        );
        
        // Decay audio excitement level smoothly
        if (excitementLevel > 0) excitementLevel -= 0.008;
        if (excitementLevel < 0) excitementLevel = 0;

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }
    animateParticles();

    /* ==========================================================================
       3. WEB AUDIO API SYNTHESIZER
       ========================================================================== */
    const delayKnob = document.getElementById('knob-tempo');
    const releaseKnob = document.getElementById('knob-reverb');
    const visualizerOverlay = document.getElementById('visualizer-overlay');

    // Initialize Web Audio nodes
    function initSynth() {
        if (isSynthInitialized) return;

        // Fallback for older browsers
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        // Create an Analyser Node for the live oscilloscope visualizer
        synthAnalyser = audioCtx.createAnalyser();
        synthAnalyser.fftSize = 512;
        
        // Create a Feedback Delay line for a beautiful premium ambient echo
        synthDelayNode = audioCtx.createDelay(5.0); // max delay time
        synthDelayFeedback = audioCtx.createGain();
        
        // Setup initial delay and feedback levels
        synthDelayNode.delayTime.value = parseFloat(delayKnob.value);
        synthDelayFeedback.gain.value = 0.35; // feedback volume ratio

        // Route Delay connections: Delay out -> Feedback Gain -> Delay in (echo loop)
        synthDelayNode.connect(synthDelayFeedback);
        synthDelayFeedback.connect(synthDelayNode);

        // Main routes to destination speakers
        // Dry (No delay): Synth Output -> Analyser -> Speakers
        // Wet (With delay): Synth Output -> Delay -> Analyser -> Speakers
        synthDelayNode.connect(synthAnalyser);
        synthAnalyser.connect(audioCtx.destination);

        isSynthInitialized = true;
        
        // Animate out the visualizer lock screen overlay
        if (visualizerOverlay) {
            visualizerOverlay.classList.add('fade-out');
            setTimeout(() => visualizerOverlay.remove(), 500);
        }
    }

    // Play a Synthesized Polyphonic Note
    function playNote(freq) {
        if (!isSynthInitialized) {
            initSynth();
        }
        
        // Safety resume for locked mobile/safari browsers
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // Trigger BG Canvas ripple movement
        excitementLevel = Math.min(excitementLevel + 0.35, 1.2);

        // 1. Setup Oscillator Node
        const osc = audioCtx.createOscillator();
        // A clean, soft triangle wave gives beautiful, melodic retro frequencies
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        // 2. Setup ADSR Gain Node (Volume Envelope)
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime); // start silent

        const attackTime = 0.015;
        const decayTime = 0.08;
        const sustainLevel = 0.7;
        const releaseTime = parseFloat(releaseKnob.value);

        // Attack Phase: Fade in fast to prevent sharp clicks
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + attackTime);
        // Decay Phase
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel * 0.3, audioCtx.currentTime + attackTime + decayTime);

        // 3. Setup Delay Time Dynamic Control
        synthDelayNode.delayTime.setValueAtTime(parseFloat(delayKnob.value), audioCtx.currentTime);

        // 4. Connecting Nodes
        osc.connect(gainNode);
        
        // Parallel connections: Connect envelope output directly to output and into delay line
        gainNode.connect(synthAnalyser);
        gainNode.connect(synthDelayNode);

        osc.start();

        // 5. Trigger Release Phase
        const sustainEndTime = audioCtx.currentTime + 0.15;
        // Release Phase: Smooth exponential drop off based on 'reverb' slider
        gainNode.gain.setValueAtTime(sustainLevel * 0.3, sustainEndTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, sustainEndTime + releaseTime);

        // Terminate oscillator once release phase finishes to free system memory
        osc.stop(sustainEndTime + releaseTime + 0.1);
    }

    /* ==========================================================================
       4. OSCILLOSCOPE WAVEFORM VISUALIZER
       ========================================================================== */
    const synthCanvas = document.getElementById('synth-visualizer');
    const synthCtx = synthCanvas.getContext('2d');
    
    // Resize Visualizer Canvas to its parent element size
    function resizeSynthCanvas() {
        synthCanvas.width = synthCanvas.parentElement.clientWidth;
        synthCanvas.height = synthCanvas.parentElement.clientHeight;
    }
    resizeSynthCanvas();
    window.addEventListener('resize', resizeSynthCanvas);

    // Drawing loop
    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);

        const width = synthCanvas.width;
        const height = synthCanvas.height;

        // Clear canvas with deep transparent overlay to create glowing motion trails
        synthCtx.fillStyle = 'rgba(10, 8, 20, 0.25)';
        synthCtx.fillRect(0, 0, width, height);

        if (!isSynthInitialized || !synthAnalyser) {
            // Draw a subtle horizontal vibrating neon wave prior to startup
            synthCtx.beginPath();
            synthCtx.lineWidth = 2;
            synthCtx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
            
            synthCtx.moveTo(0, height / 2);
            for (let x = 0; x < width; x++) {
                const y = (height / 2) + Math.sin(x * 0.05 + Date.now() * 0.005) * 1.5;
                synthCtx.lineTo(x, y);
            }
            synthCtx.stroke();
            return;
        }

        // Draw Live Oscilloscope Waveform from Analyser
        const bufferLength = synthAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        synthAnalyser.getByteTimeDomainData(dataArray);

        synthCtx.beginPath();
        synthCtx.lineWidth = 3;
        
        // Glowing Neon Gradient for the line
        const gradient = synthCtx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#ff0844');
        gradient.addColorStop(0.5, '#7f00ff');
        gradient.addColorStop(1, '#467FF7');
        synthCtx.strokeStyle = gradient;
        
        synthCtx.shadowBlur = 10;
        synthCtx.shadowColor = 'rgba(70, 127, 247, 0.5)';

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Normalized between 0 and 2
            const y = v * (height / 2);

            if (i === 0) {
                synthCtx.moveTo(x, y);
            } else {
                synthCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        synthCtx.lineTo(width, height / 2);
        synthCtx.stroke();
        
        // Reset shadows to preserve other rendering performance
        synthCtx.shadowBlur = 0;
    }
    
    // Start Visualizer rendering loop
    drawVisualizer();

    /* ==========================================================================
       5. USER UI INTERACTION TRIGGERS
       ========================================================================== */
    const synthPads = document.querySelectorAll('.synth-pad');
    
    synthPads.forEach(pad => {
        const note = pad.getAttribute('data-note');
        
        // Click / Mouse Trigger
        pad.addEventListener('click', () => {
            triggerPadVisuals(pad);
            playNote(noteFrequencies[note]);
        });

        // Touch Trigger
        pad.addEventListener('touchstart', (e) => {
            e.preventDefault(); // prevents standard double trigger
            triggerPadVisuals(pad);
            playNote(noteFrequencies[note]);
        }, { passive: false });
    });

    // Handle Pad Click/Touch visual active animation
    function triggerPadVisuals(pad) {
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 150);

        // Circular progress visualizer sync inside avatar badge
        const progressCircle = document.querySelector('.circle-progress');
        if (progressCircle) {
            const randomOffset = Math.random() * 283;
            progressCircle.style.strokeDashoffset = randomOffset;
            
            // Randomize stroke color on trigger for high-end feel
            const notes = Object.keys(padClasses);
            const randomNote = notes[Math.floor(Math.random() * notes.length)];
            progressCircle.style.stroke = padClasses[randomNote];
        }
    }

    // Delay range adjustment listener (creates dynamic soundscapes on change)
    delayKnob.addEventListener('input', () => {
        if (isSynthInitialized && synthDelayNode) {
            synthDelayNode.delayTime.setValueAtTime(parseFloat(delayKnob.value), audioCtx.currentTime);
        }
    });

    // Initialize audio system if clicking on the Visualizer box
    visualizerOverlay.addEventListener('click', initSynth);

    /* ==========================================================================
       6. COPY EMAIL SYSTEM (TOAST NOTIFICATIONS)
       ========================================================================== */
    const emailButton = document.getElementById('link-email');
    const toast = document.getElementById('toast');
    const emailText = 'roci42madrid@gmail.com';

    emailButton.addEventListener('click', () => {
        // Use standard clipboard API
        navigator.clipboard.writeText(emailText).then(() => {
            showToast();
        }).catch(err => {
            // Fallback for legacy contexts
            const textArea = document.createElement('textarea');
            textArea.value = emailText;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast();
            } catch (fallbackErr) {
                console.error('Copy fallback failed: ', fallbackErr);
            }
            document.body.removeChild(textArea);
        });
    });

    function showToast() {
        toast.classList.add('show');
        
        // Success animation effect on email button itself
        const badge = emailButton.querySelector('.copy-badge span');
        if (badge) {
            badge.innerText = '¡Copiado!';
            emailButton.style.borderColor = 'rgba(39, 174, 96, 0.4)';
            setTimeout(() => {
                badge.innerText = 'Copiar';
                emailButton.style.borderColor = '';
            }, 2000);
        }

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }
});
