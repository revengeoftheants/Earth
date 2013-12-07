/*
 * Creates a 3D earth with WebGL.
 *
 * Texture maps were created by Tom Patterson, www.shadedrelief.com, and are in the public domain.
 *
 *
 * This uses a Self-Executing Anonymous Function to declare the namespace "Main" and create public and private members within it.
 *
 * @author Kevin Dean
 *
 * Textures:
 *  **** All maps conform to the WG 8S4 standard.
 *	Star field - http://paulbourke.net/miscellaneous/starfield/
 *	International borders - http://www.shadedrelief.com/natural3/pages/extra.html
 */

/*
 * @param Main: Defines the namespace to use for public members of this class.
 * @param undefined: Nothing should be passed via this parameter. This ensures that you can use "undefined" here without worrying that another loaded
 *						script as redefined the global variable "undefined".
 */
(function(Main, undefined) {

	/**********************
	 * Constants
	 **********************/
	var CAM = {FOV_ANGLE_NBR: 45, NEAR_PLANE_NBR: 0.1, FAR_PLANE_NBR: 1000};
	var EARTH_NBRS = {RADIUS: 0.5, SEGMENTS: 90, ROTATION: 6};
	var STARS_NBRS = {RADIUS: 100, SEGMENTS: 32};
	var MIN_TEXTURE_PIXEL_NBR = 4096;  // This is the size of the largest texture we initially load.
	var TEXTURE_NMS = {EARTH_0: "earth_0", BUMP_0: "bump_0", SPEC_0: "spec_0", BORDERS_0: "borders_0", LIGHTS_0: "lights_0", CLOUDS_0: "clouds_0",
					   EARTH_1: "earth_1", BUMP_1: "bump_1", SPEC_1: "spec_1", BORDERS_1: "borders_1", LIGHTS_1: "lights_1", CLOUDS_1: "clouds_1", STARS: "stars"};
	var TEXTURE_STATE_NBRS = {DO_NOT_LOAD: 0, LOADING: 1, UPDATED: 2};


	/**********************
	 * Global variables
	 **********************/
	var _renderer, _camera, _scene, _controls, _stats, _animationFrameId, _maxTexturePixelNbr;
	var _canvasWidth = window.innerWidth, _canvasHeight = window.innerHeight;
	var _textures, _sun, _earthMesh, _boundsMesh, _lightsMesh, _cloudsMesh;
	var _earthTextureStateNbr, _bumpTextureStateNbr, _bordersTextureStateNbr, _lightsTextureStateNbr, _cloudsTextureStateNbr;
	var  _updtMatsInd = true, _clock;




	/**********************
	 * Public methods
	 **********************/



	/*
	 * Determines if the user's browser and machine are WebGL-capable.
	 */
	Main.CheckCompatibility = function() {
		var compatibleInd = true;

		if (Detector.webgl === false) {
			Detector.addGetWebGLMessage();
			compatibleInd = false;
		} else if (Detector.chrome === false) {
			Detector.addGetChromeMessage();
			compatibleInd = false;
		} else {
			var gl = document.createElement('canvas').getContext("experimental-webgl");
			_maxTexturePixelNbr = gl.getParameter(gl.MAX_TEXTURE_SIZE);

			if (_maxTexturePixelNbr < MIN_TEXTURE_PIXEL_NBR) {
				compatibleInd = false;

				var element = document.createElement('div');
				element.id = 'maxTextureSizeTooSmall';
				element.style.fontFamily = 'monospace'; 
				element.style.fontSize = '13px';
				element.style.fontWeight = 'normal';
				element.style.textAlign = 'center';
				element.style.background = '#FFF';
				element.style.color = '#000';
				element.style.padding = '1.5em';
				element.style.width = '400px';
				element.style.margin = '5em auto 0';
				element.innerHTML = 'This application uses high-resolution images, which exceed the capabilities of your device\'s graphics processor.';
				document.body.insertBefore(element, document.body.childNodes[0]);
			}
		}

		return compatibleInd;
	};


	/*
	 * Initializes the scene.
	 */
	Main.InitScene = function() {

		try {
			_clock = new THREE.Clock();

			loadImages();
			initRenderer();
			initSceneAndCamera();
			initStats();
			initGUI();
			
			addContextLostListener();

			animate();

		} catch ( error ) {

			document.getElementById("container").innerHTML = "There was a problem with WebGL. Please reload the page.";
		}
	};




	/**********************
	 * Private methods
	 **********************/


	/*
	 * Caches our images so that they will be ready for use when needed.
	 * 
	 */
	function loadImages() {
		_textures = [];

		_textures[TEXTURE_NMS.EARTH_0] = THREE.ImageUtils.loadTexture('images/world_topo_bathy_2048x1024.jpg'); // No need for transparency.
		_textures[TEXTURE_NMS.BUMP_0] = THREE.ImageUtils.loadTexture('images/elev_bump_map_2048x1024.jpg'); // No need for transparency.
		_textures[TEXTURE_NMS.SPEC_0] = THREE.ImageUtils.loadTexture('images/water_512x256.jpg');
		_textures[TEXTURE_NMS.BORDERS_0] = THREE.ImageUtils.loadTexture('images/international_boundaries_4096x8192.png');
		_textures[TEXTURE_NMS.LIGHTS_0] = THREE.ImageUtils.loadTexture('images/lights_2048x1024.png');
		_textures[TEXTURE_NMS.CLOUDS_0] = THREE.ImageUtils.loadTexture('images/fair_clouds_2048x1024.png');
		_textures[TEXTURE_NMS.STARS] = THREE.ImageUtils.loadTexture('images/galaxy_starfield_4096x2048.png');

		_earthTextureStateNbr = _bumpTextureStateNbr= _bordersTextureStateNbr = _lightsTextureStateNbr = _cloudsTextureStateNbr = TEXTURE_STATE_NBRS.DO_NOT_LOAD;

		if (_maxTexturePixelNbr >= 8192) {
			_textures[TEXTURE_NMS.EARTH_1] = THREE.ImageUtils.loadTexture('images/world_topo_bathy_8192x4096.jpg');
			_textures[TEXTURE_NMS.BUMP_1] = THREE.ImageUtils.loadTexture('images/elev_bump_map_8192x4096.jpg');
			_textures[TEXTURE_NMS.BORDERS_1] = THREE.ImageUtils.loadTexture('images/international_boundaries_8192x4096.png');
			_textures[TEXTURE_NMS.LIGHTS_1] = THREE.ImageUtils.loadTexture('images/lights_8192x4096.png');
			_textures[TEXTURE_NMS.CLOUDS_1] = THREE.ImageUtils.loadTexture('images/fair_clouds_4096x2048.png');

			_earthTextureStateNbr = _bumpTextureStateNbr = _bordersTextureStateNbr = _lightsTextureStateNbr = _cloudsTextureStateNbr = TEXTURE_STATE_NBRS.LOADING;
		} else if (_maxTexturePixelNbr >= 4096) {
			_textures[TEXTURE_NMS.EARTH_1] = THREE.ImageUtils.loadTexture('images/world_topo_bathy_4096x2048.jpg');
			_textures[TEXTURE_NMS.BUMP_1] = THREE.ImageUtils.loadTexture('images/elev_bump_map_4096x2048.jpg');
			_textures[TEXTURE_NMS.BORDERS_1] = _textures[TEXTURE_NMS.BORDERS_0];
			_textures[TEXTURE_NMS.LIGHTS_1] = THREE.ImageUtils.loadTexture('images/lights_4096x2048.png');
			_textures[TEXTURE_NMS.CLOUDS_1] = _textures[TEXTURE_NMS.CLOUDS_0];

			_earthTextureStateNbr = _bumpTextureStateNbr = _bordersTextureStateNbr = _lightsTextureStateNbr = _cloudsTextureStateNbr = TEXTURE_STATE_NBRS.LOADING;
		}
	}


	/*
	 * Initializes the renderer.
	 */
	function initRenderer() {

		// Set preserveDrawingBuffer = true to get screenshot capability.
		_renderer = new THREE.WebGLRenderer( { antialias: true, preserveDrawingBuffer: false } );

		_renderer.setSize(_canvasWidth, _canvasHeight);  // Cannot set size via constructor parameters for WebGL_renderer.

		// Gamma correction
		_renderer.gammaInput = true;
		_renderer.gammaOutput = true;
		
		_renderer.shadowMapEnabled = true;  // Shadows are enabled.

		var container = document.getElementById('container');
		container.appendChild( _renderer.domElement );
	}



	/*
	 * Initializes the camera and scene.
	 */
	function initSceneAndCamera() {
		_scene = new THREE.Scene();

		// Create the camera itself
		_camera = new THREE.PerspectiveCamera(CAM.FOV_ANGLE_NBR, _canvasWidth / _canvasHeight, CAM.NEAR_PLANE_NBR, CAM.FAR_PLANE_NBR);
		_camera.position.z = 1.5;
		_camera.rotationAutoUpdate = true;  // This is set to true by default. It forces the rotationMatrix to get calculated each frame.
		_scene.add(_camera);

		_controls = new THREE.TrackballControls(_camera);
		_controls.minDistance = 0.7;
		_controls.maxDistance = 200;
		_controls.noPan = true;

		_scene.add(new THREE.AmbientLight(0x333333));

		_sun = new THREE.DirectionalLight(0xFFFFFF, 1);
		_sun.position.set(-1, 0, 0.25);
		_scene.add(_sun);


		var earthGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var earthMat = 	new THREE.MeshPhongMaterial({
    		map: _textures[TEXTURE_NMS.EARTH_0],
    		bumpMap: _textures[TEXTURE_NMS.BUMP_0],
    		bumpScale: 0.01,
    		specularMap: _textures[TEXTURE_NMS.SPEC_0],
    		specular: new THREE.Color('grey')
		});
		_earthMesh = new THREE.Mesh(earthGeom, earthMat);

		_scene.add(_earthMesh);


		var boundsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.001, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var boundsMat = new THREE.MeshBasicMaterial({
			map: _textures[TEXTURE_NMS.BORDERS_0],
			transparent: true
		});
		_boundsMesh = new THREE.Mesh(boundsGeom, boundsMat);

		_scene.add(_boundsMesh);


		
		var lightsUniforms = {
			inpTexture: {type: "t", value: _textures[TEXTURE_NMS.LIGHTS_0]},
			inpSunPos: {type: "v3", value: _sun.position},
			inpEarthTransform: {type: "m4", value: _earthMesh.matrix},
			inpSunTransform: {type: "m4", value: _sun.matrixWorld}
		};


		var lightsMat = new THREE.ShaderMaterial({
			vertexShader: EarthShaders["nightLights"].vertexShader,
			fragmentShader: EarthShaders["nightLights"].fragmentShader,
			uniforms: lightsUniforms,
			transparent: true
		});


		var lightsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.002, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		_lightsMesh = new THREE.Mesh(lightsGeom, lightsMat);

		_scene.add(_lightsMesh);


		var cloudsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.003, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var cloudsMat = new THREE.MeshPhongMaterial({
			map: _textures[TEXTURE_NMS.CLOUDS_0],
			transparent: true
		});
		_cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);

		_scene.add(_cloudsMesh);


		// Tilt the earth 23.4 degrees.
		_earthMesh.rotation.x = _boundsMesh.rotation.x = _lightsMesh.rotation.x = _cloudsMesh.rotation.x = THREE.Math.degToRad(23.4);


		var starsGeom = new THREE.SphereGeometry(STARS_NBRS.RADIUS, STARS_NBRS.SEGMENTS, STARS_NBRS.SEGMENTS);
		var starsMat = new THREE.MeshBasicMaterial({
			map: _textures[TEXTURE_NMS.STARS],
			side: THREE.BackSide
		});
		var starsMesh = new THREE.Mesh(starsGeom, starsMat);

		_scene.add(starsMesh);
	}



	/*
	 * Initializes the Stats window.
	 */
	function initStats() {
		_stats = new Stats();
		_stats.domElement.style.position = "absolute";
		_stats.domElement.style.top = "8px";
		_stats.domElement.style.zIndex = 100;
		container.appendChild(_stats.domElement);
	}



	/*
	 * Initializes the GUI pane.
	 */
	function initGUI() {
		var gui = new dat.GUI();

		_effectController = {
			//muteInd: false,
			//patternCnt: 3
		};

		//gui.add(_effectController, "muteInd").name("No Music");
		//gui.add(_effectController, "patternCnt", 0, PATTERN_NBRS.MAX_CNT).step(1).name("Pattern Count");
	}



	/*
	 * Creates the animation loop.
	 */
	function animate() {
		// Rendering loop.
		_animationFrameId = window.requestAnimationFrame(animate);
		render();
		_stats.update();
	}



	/*
	 * Renders the scene during each animation loop.
	 */
	function render() {
		if (_renderer.getContext().isContextLost()) {
			console.log("Context lost!");
		}

		_controls.update();

		// Render
		_renderer.render(_scene, _camera);

		if (_clock.running == false) {
			_clock.start();
		}

		if (_updtMatsInd == true) {
			if (_clock.getElapsedTime() >= 0.1) {
				_clock.stop();
				_clock.elapsedTime = 0;
				updtMatTextures();
			}
		} else {
			_earthMesh.rotation.y = _boundsMesh.rotation.y = _cloudsMesh.rotation.y = _lightsMesh.rotation.y += 0.0005;
		}

	}



	/*
	 * Updates our material textures to higher resolution versions if they exist.
	 */
	function updtMatTextures() {

		var matUpdtdInd = false;


		if (matUpdtdInd == false && _textures[TEXTURE_NMS.BORDERS_1] !== null && _bordersTextureStateNbr !== TEXTURE_STATE_NBRS.UPDATED) {

			_boundsMesh.material.map = _textures[TEXTURE_NMS.BORDERS_1];
			_boundsMesh.material.map.needsUpdate = true;

			_bordersTextureStateNbr = TEXTURE_STATE_NBRS.UPDATED;
			matUpdtdInd = true;
		}


		if (matUpdtdInd == false && _textures[TEXTURE_NMS.LIGHTS_1] !== null && _lightsTextureStateNbr !== TEXTURE_STATE_NBRS.UPDATED) {
			_lightsMesh.material.uniforms.inpTexture.value = _textures[TEXTURE_NMS.LIGHTS_1];
			_lightsMesh.material.uniforms.inpTexture.needsUpdate = true;

			_lightsTextureStateNbr = TEXTURE_STATE_NBRS.UPDATED;
			matUpdtdInd = true;
		}


		if (matUpdtdInd == false && _textures[TEXTURE_NMS.CLOUDS_1] !== null && _cloudsTextureStateNbr !== TEXTURE_STATE_NBRS.UPDATED) {

			_cloudsMesh.material.map = _textures[TEXTURE_NMS.CLOUDS_1];
			_cloudsMesh.material.map.needsUpdate = true;

			_cloudsTextureStateNbr = TEXTURE_STATE_NBRS.UPDATED;
			matUpdtdInd = true;
		}


		if (matUpdtdInd == false && _textures[TEXTURE_NMS.EARTH_1] !== null && _earthTextureStateNbr !== TEXTURE_STATE_NBRS.UPDATED &&
		    _textures[TEXTURE_NMS.BUMP_1] !== null && _bumpTextureStateNbr !== TEXTURE_STATE_NBRS.UPDATED) {

    		_earthMesh.material.map = _textures[TEXTURE_NMS.EARTH_1];
    		_earthMesh.material.map.needsUpdate = true;
    		_earthMesh.material.bumpMap = _textures[TEXTURE_NMS.BUMP_1];
    		_earthMesh.material.bumpMap.needsUpdate = true;

    		_earthTextureStateNbr = _bumpTextureStateNbr = TEXTURE_STATE_NBRS.UPDATED;
    		matUpdtdInd = true;
		}
		

		if ((_earthTextureStateNbr == TEXTURE_STATE_NBRS.DO_NOT_LOAD || _earthTextureStateNbr == TEXTURE_STATE_NBRS.UPDATED) &&
		    (_bumpTextureStateNbr == TEXTURE_STATE_NBRS.DO_NOT_LOAD || _bumpTextureStateNbr == TEXTURE_STATE_NBRS.UPDATED) && 
		    (_lightsTextureStateNbr == TEXTURE_STATE_NBRS.DO_NOT_LOAD || _lightsTextureStateNbr == TEXTURE_STATE_NBRS.UPDATED) &&
		    (_cloudsTextureStateNbr == TEXTURE_STATE_NBRS.DO_NOT_LOAD || _cloudsTextureStateNbr == TEXTURE_STATE_NBRS.UPDATED)) {
			_updtMatsInd = false;
		}
	}



	/*
	 * Adds a listener for the webglcontextlost  event.
	 */
	function addContextLostListener() {
		_renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
	}



	/*
	 * Handles the event of the WebGL context being lost.
	 */
	function handleContextLost(inpEvent) {
		// By default when a WebGL program loses its context, it never gets that context back. Prevent this default behavior.
		inpEvent.preventDefault();

		// Turn off the rendering loop.
		window.cancelAnimationFrame(_animationFrameId);
		
		// Rebuild the scene.
		Main.InitScene();
	}



	/*
	 * Handles the window being resized.
	 */
	window.addEventListener("resize", function(inpEvent) {
		_canvasWidth = window.innerWidth;
		_canvasHeight = window.innerHeight;
		_camera.aspect = _canvasWidth / _canvasHeight;
		_camera.updateProjectionMatrix();
		_renderer.setSize(_canvasWidth, _canvasHeight);
	});


	/*
	 * Adds screenshot capability.
	 */
	/*
	window.addEventListener("keyup", function(inpEvent) {
		var imgData;
		var button = document.getElementById('saveImg');

		//Listen to 'P' key
		if (inpEvent.which !== 80) return;

		try {
			imgData = _renderer.domElement.toDataURL();      
			console.log(imgData);
		}
		catch(excp) {
			console.log("Browser does not support taking screenshot of 3d context");
			return;
		}

		button.onclick = function() {
			window.location.href = imgData.replace('image/png', 'image/octet-stream');
		};
	});
	*/

} (window.Main = window.Main || {}) );