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
	var STARS_NBRS = {RADIUS: 100, SEGMENTS: 64};


	/**********************
	 * Global variables
	 **********************/
	var _renderer, _camera, _scene, _controls, _stats, _animationFrameId;
	var _canvasWidth = window.innerWidth, _canvasHeight = window.innerHeight;
	var _sun, _earthMesh, _boundsMesh, _lightsMesh, _cloudsMesh;




	/**********************
	 * Public methods
	 **********************/



	/*
	 * Determines if the user's browser and machine are WebGL-capable.
	 */
	Main.CheckCompatibility = function() {
		var compatibleInd = true;

		/*
		if (Detector.webgl === false) {
			Detector.addGetWebGLMessage();
			compatibleInd = false;
		} else if (Detector.chrome === false) {
			Detector.addGetChromeMessage();
			compatibleInd = false;
		}
		*/

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

			animate();

		} catch ( error ) {

			document.getElementById("container").innerHTML = "There was a problem with WebGL. Please reload the page.";
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
		_camera.position.z = 1.75;
		_camera.rotationAutoUpdate = true;  // This is set to true by default. It forces the rotationMatrix to get calculated each frame.
		_scene.add(_camera);

		_controls = new THREE.TrackballControls(_camera);

		_scene.add(new THREE.AmbientLight(0x333333));

		_sun = new THREE.DirectionalLight(0xFFFFFF, 1);
		_sun.position.set(1, 0, 0);
		_scene.add(_sun);


		var earthGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var earthMat = 	new THREE.MeshPhongMaterial({
    		map: THREE.ImageUtils.loadTexture('images/world.topo.bathy.200408.3x5400x2700.png'),
    		//bumpMap: THREE.ImageUtils.loadTexture('images/elev_bump_4k.jpg'),
    		bumpMap: THREE.ImageUtils.loadTexture('images/elev_bump_map_8K.png'),
    		bumpScale: 0.01,
    		specularMap: THREE.ImageUtils.loadTexture('images/water_4K.png'),
    		specular: new THREE.Color('grey')
		});
		_earthMesh = new THREE.Mesh(earthGeom, earthMat);

		_scene.add(_earthMesh);


		var boundsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.001, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var boundsMat = new THREE.MeshBasicMaterial({
			map: THREE.ImageUtils.loadTexture('images/international_boundaries_8K.png'),
			transparent: true
		});
		_boundsMesh = new THREE.Mesh(boundsGeom, boundsMat);

		_scene.add(_boundsMesh);


		
		var lightsUniforms = {
			inpTexture: { type: "t", value: THREE.ImageUtils.loadTexture('images/lights_transparent_8K.png'),},
			inpSunPos: {type: "v3", value: _sun.position},
			inpEarthTransform: {type: "m4", value: _earthMesh.matrix},
			inpSunTransform: {type: "m4", value: _sun.matrixWorld}
		};


		var lightsShaderMat = new THREE.ShaderMaterial({
			vertexShader: EarthShaders["nightLights"].vertexShader,
			fragmentShader: EarthShaders["nightLights"].fragmentShader,
			uniforms: lightsUniforms,
			transparent: true
		});




		var lightsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.002, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		/*
		var lightsMat = new THREE.MeshBasicMaterial({
			map: THREE.ImageUtils.loadTexture('images/lights_transparent_8K.png'),
			transparent: true
		});
		*/
		_lightsMesh = new THREE.Mesh(lightsGeom, lightsShaderMat);

		_scene.add(_lightsMesh);


		var cloudsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.003, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var cloudsMat = new THREE.MeshPhongMaterial({
			map: THREE.ImageUtils.loadTexture('images/fair_clouds_4K.png'),
			transparent: true
		});
		_cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);

		_scene.add(_cloudsMesh);


		// Tilt the earth 23.4 degrees.
		_earthMesh.rotation.x = _boundsMesh.rotation.x = _lightsMesh.rotation.x = _cloudsMesh.rotation.x = THREE.Math.degToRad(23.4);


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

		_earthMesh.rotation.y = _boundsMesh.rotation.y = _cloudsMesh.rotation.y = _lightsMesh.rotation.y += 0.0005;

		// Render
		_renderer.render(_scene, _camera);
	}


	function convertDegsToCartesian(inpLatitudeDegNbr, inpLongitudeDegNbr, inpRadiusLenNbr) {

		/* We are using the geographic coordinate system rather than the spherical coordinate system (i.e., latitude is measured
		 * in degrees away from the equator rather than from the pole). Note also that we are using the traditional 
		 * world coordinate system here, which differs from that used for spherical coordinates (where Y is to the right, 
		 * Z is up, and X is forward).
		 */
		var x = inpRadiusLenNbr * Math.cos(THREE.Math.degToRad(inpLatitudeDegNbr)) * Math.cos(THREE.Math.degToRad(inpLongitudeDegNbr));
		var y = inpRadiusLenNbr * Math.sin(THREE.Math.degToRad(inpLatitudeDegNbr));
		var z = inpRadiusLenNbr * Math.cos(THREE.Math.degToRad(inpLatitudeDegNbr)) * Math.sin(THREE.Math.degToRad(inpLongitudeDegNbr));

		
		return new Vector3(x, y, z);
	}



	function drawLines() {
		/* Starting at the current spot in our data, retrieve the next entry. If 
		 *
		 * We load all our data into a collection keyed by timestamp. Search by getting the first entry greater than the current time we have.
		 *
		 */
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