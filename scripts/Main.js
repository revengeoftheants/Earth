/*
 * Creates a 3D earth with WebGL.
 *
 *
 * This uses a Self-Executing Anonymous Function to declare the namespace "Main" and create public and private members within in.
 *
 * @author Kevin Dean
 *
 */

/*
 * @param Main: Defines the namespace to use for public members of this class.
 * @param $: The shorthand to use for jQuery.
 * @param undefined: Nothing should be passed via this parameter. This ensures that you can use "undefined" here without worrying that another loaded
 *						script as redefined the global variable "undefined".
 */
(function(Main, $, undefined) {

	/**********************
	 * Constants
	 **********************/
	var CAM = {FOV_ANGLE_NBR: 45, NEAR_PLANE_NBR: 0.1, FAR_PLANE_NBR: 1000};
	var EARTH_NBRS = {RADIUS: 0.5, SEGMENTS: 90, ROTATION: 6};
	var STARS_NBRS = {RADIUS: 100, SEGMENTS: 64};


	/**********************
	 * Global variables
	 **********************/
	var _camera, _scene, _controls, _stats, _animationFrameId;
	var _canvasWidth = window.innerWidth, _canvasHeight = window.innerHeight;
	var _earthMesh, _cloudsMesh;




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
		}

		return compatibleInd;
	};


	/*
	 * Initializes the scene.
	 */
	Main.InitScene = function() {

		try {
			
			
			initRenderer();
			initSceneAndCamera();
			initStats();
			initGUI();
			
			addContextLostListener();

			
			$(window).load( function() {
				animate();
			});
		} catch ( error ) {

			$(container).innerHTML = "There was a problem with WebGL. Please reload the page.";
		}
	};




	/**********************
	 * Private methods
	 **********************/


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

		_scene.add(new THREE.AmbientLight(0x333333));

		var light = new THREE.DirectionalLight(0xFFFFFF, 1);
		light.position.set(5, 3, 5);
		_scene.add(light);


		var earthGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var earthMat = 	new THREE.MeshPhongMaterial({
    		map: THREE.ImageUtils.loadTexture('images/earth_no_clouds_8K.jpg'),
    		//bumpMap: THREE.ImageUtils.loadTexture('images/elev_bump_4k.jpg'),
    		bumpMap: THREE.ImageUtils.loadTexture('images/elev_bump_map_8K.png'),
    		bumpScale: 0.01,
    		specularMap: THREE.ImageUtils.loadTexture('images/water_4K.png'),
    		specular: new THREE.Color('grey')
		});
		_earthMesh = new THREE.Mesh(earthGeom, earthMat);

		_scene.add(_earthMesh);


		var cloudsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.003, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var cloudsMat = new THREE.MeshPhongMaterial({
			map: THREE.ImageUtils.loadTexture('images/fair_clouds_4k.png'),
			transparent: true
		});
		_cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);

		_scene.add(_cloudsMesh);


		var starsGeom = new THREE.SphereGeometry(STARS_NBRS.RADIUS, STARS_NBRS.SEGMENTS, STARS_NBRS.SEGMENTS);
		var starsMat = new THREE.MeshBasicMaterial({
			map: THREE.ImageUtils.loadTexture('images/galaxy_starfield.png'),
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

		_earthMesh.rotation.y += 0.0005;
		_cloudsMesh.rotation.y += 0.0005;

		// Render
		_renderer.render(_scene, _camera);
	}



	/*
	 * Adds a listener for the webglcontextlost  event.
	 */
	function addContextLostListener() {
		this._renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
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

} (window.Main = window.Main || {}, jQuery) );