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
 *  Earth with topography and bathymetry - http://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x21600x10800.jpg
 *  Earth bump map - http://www.shadedrelief.com/natural3/pages/extra.html
 *  Earth specular map - http://www.shadedrelief.com/natural3/pages/extra.html
 *	International borders - http://www.shadedrelief.com/natural3/pages/extra.html
 *  Lights - http://www.shadedrelief.com/natural3/pages/textures.html
 *  Clouds - http://www.shadedrelief.com/natural3/pages/clouds.html
 *  Star field - http://paulbourke.net/miscellaneous/starfield/
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
	var EARTH_NBRS = {RADIUS: 0.5, SEGMENTS: 90, ROTATION_VELOCITY: 0.0005};
	var STARS_NBRS = {RADIUS: 100, SEGMENTS: 32};
	var MIN_TEXTURE_PIXEL_NBR = 4096;  // This is the size of the largest texture we initially load.
	var MESH_SCALE_VECTS = {DISPLAY: new THREE.Vector3(1,1,1), HIDE: new THREE.Vector3(0,0,0)};


	/**********************
	 * Global variables
	 **********************/
	var _clock, _renderer, _camera, _scene, _controls, _stats, _animationFrameId, _maxTexturePixelNbr;
	var _canvasWidth = window.innerWidth, _canvasHeight = window.innerHeight;
	var _sun, _earthMesh, _bordersMesh, _lightsMesh, _cloudsMesh;
	var _progressCntnr, _progressBar, _textures = [];
	var _textureUris = {earth: "", bump: "", spec: "", borders: "", lights: "", clouds: "", stars: ""};
	var _meshesToBuildCnt = 0;
	var _controlNms = {TOPO: "displayTopoInd", BORDERS: "displayBordersInd", LIGHTS: "displayNightLightsInd", CLOUDS: "displayCloudsInd"};




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

			initRenderer();
			loadImages();
			initSceneAndCamera();
			initStats();
			initGUI();
			
			addContextLostListener();

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
		_progressCntnr = document.getElementById("progressCntnr");
		_progressBar = document.createElement("progress");
		_progressBar.max = 1;  // The max attribute must have a value > 0.
		_progressBar.removeAttribute("value");  // Without the "value" attribute, our progress is in an indeterminate stage.
		_progressCntnr.appendChild(_progressBar);

		_textureUris.spec = "images/water_512x256.jpg";
		_textureUris.clouds = "images/fair_clouds_4096x2048.png";
		_textureUris.stars = "images/galaxy_starfield_4096x2048.png";

		if (_maxTexturePixelNbr >= 8192) {
			_textureUris.earth = "images/world_topo_bathy_8192x4096.jpg";
			_textureUris.bump = "images/elev_bump_map_8192x4096.jpg";
			_textureUris.borders = "images/international_boundaries_8192x4096.png";
			_textureUris.lights = "images/lights_8192x4096.png";
		} else {
			_textureUris.earth = "images/world_topo_bathy_4096x2048.jpg";
			_textureUris.bump = "images/elev_bump_map_4096x2048.jpg";
			_textureUris.borders = "images/international_boundaries_4096x2048.png";
			_textureUris.lights = "images/lights_4096x2048_min62.png";
		}

		for (var key in _textureUris) {
			if (_textureUris.hasOwnProperty(key)) {
				requestImg(_textureUris[key]);
				_meshesToBuildCnt++;
				_progressBar.max++;
			}
		}

		_progressBar.max -= 1;  // Subtract 1 from the progress bar's max since we have to start it at 1 rather than 0.
	}



	/*
	 * Requests an image.
	 *
	 * @param inpImgUri - The URI for the desired image.
	 */
	function requestImg (inpImgUri) {
		var request = new XMLHttpRequest();
		request.ID = inpImgUri;

		var fileExtTxt = inpImgUri.substring(inpImgUri.length - 3);

		if (fileExtTxt == "jpg") {
			fileExtTxt = "jpeg";
		}
		_textures[inpImgUri] = {httpRequestObj: request, fileTyp: fileExtTxt, totSzNbr: 0, loadedSzNbr: 0, textureObj: null};
		request.onload = crteImgElem;
		request.open("GET", inpImgUri, true);
		request.overrideMimeType('text/plain; charset=x-user-defined'); 
		request.send(null);
	}



	/*
	 * Creates a DOM element for this image.
	 *
	 * @param inpEvent - The event that triggered this function.
	 */
	function crteImgElem(inpEvent) {
		var imgElem = document.createElement("img");
		var texture = new THREE.Texture(imgElem);
		_textures[inpEvent.currentTarget.ID].textureObj = texture;
		imgElem.onload = function()  {
			texture.needsUpdate = true;
		};
		imgElem.src = "data:image/" + _textures[inpEvent.currentTarget.ID].fileTyp + ";base64," + encodeInBase64(_textures[inpEvent.currentTarget.ID].httpRequestObj.responseText);

		_progressBar.value++;

		switch (inpEvent.currentTarget.ID) {
			case _textureUris.earth:
				crteEarthMesh(); break;
			case _textureUris.bump:
				crteEarthMesh(); break;
			case _textureUris.spec:
				crteEarthMesh(); break;
			case _textureUris.borders:
				crteBordersMesh(); break;
			case _textureUris.lights:
				crteNightLightsMesh(); break;
			case _textureUris.clouds:
				crteCloudsMesh(); break;
			case _textureUris.stars:
				crteStarsMesh(); break;
		}

		_meshesToBuildCnt--;


		// If all our meshes are built, we're ready to start animations.
		if (_meshesToBuildCnt == 0) {
			// Tilt the earth 23.4 degrees.
			_earthMesh.rotation.x = _bordersMesh.rotation.x = _lightsMesh.rotation.x = _cloudsMesh.rotation.x = THREE.Math.degToRad(23.4);

			// Remove the progress bar and start the animation loop.
			document.body.removeChild(_progressCntnr);
			animate();
		}
	}



	/*
	 * Encodes text in base 64.
	 * 
	 * This encoding function is from Philippe Tenenhaus's example at http://www.philten.com/us-xmlhttprequest-image/
	 */
	function encodeInBase64(inpTxt) {
		var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
		var rtnTxt = "";
		var i = 0;

		while (i < inpTxt.length){
			//all three "& 0xff" added below are there to fix a known bug 
			//with bytes returned by xhr.responseText
			var byte1 = inpTxt.charCodeAt(i++) & 0xff;
			var byte2 = inpTxt.charCodeAt(i++) & 0xff;
			var byte3 = inpTxt.charCodeAt(i++) & 0xff;

			var enc1 = byte1 >> 2;
			var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);

			var enc3, enc4;

			if (isNaN(byte2)) {
				enc3 = enc4 = 64;
			} else {
				enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
				
				if (isNaN(byte3)) {
					enc4 = 64;
				} else {
					enc4 = byte3 & 63;
				}
			}

			rtnTxt += b64.charAt(enc1) + b64.charAt(enc2) + b64.charAt(enc3) + b64.charAt(enc4);
		} 

		return rtnTxt;
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

		document.getElementById("container").appendChild( _renderer.domElement );
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

		// Must add the renderer DOM element to TrackballControls so that a mouse click on the Dat GUI doesn't steal focus.
		_controls = new THREE.TrackballControls(_camera, _renderer.domElement);

		_controls.minDistance = 0.7;
		_controls.maxDistance = 200;
		_controls.noPan = true;

		_scene.add(new THREE.AmbientLight(0x333333));

		_sun = new THREE.DirectionalLight(0xFFFFFF, 1);
		_sun.position.set(-1, 0, 0.25);
		_scene.add(_sun);
	}



	/*
	 * Creates the main earth mesh.
	 */
	function crteEarthMesh() {

		if (_earthMesh == null && 
			_textures[_textureUris.earth].textureObj !== null &&
			_textures[_textureUris.bump].textureObj !== null &&
			_textures[_textureUris.spec].textureObj !== null) {

			var earthGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
			var earthMat = 	new THREE.MeshPhongMaterial({
	    		map: _textures[_textureUris.earth].textureObj,
	    		bumpMap: _textures[_textureUris.bump].textureObj,
	    		bumpScale: 0.01,
	    		specularMap: _textures[_textureUris.spec].textureObj,
	    		specular: new THREE.Color('grey')
			});
			_earthMesh = new THREE.Mesh(earthGeom, earthMat);

			_scene.add(_earthMesh);
		}
	}



	/*
	 * Creates the international borders mesh.
	 */
	function crteBordersMesh() {
		var bordersGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.001, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var bordersMat = new THREE.MeshBasicMaterial({
			map: _textures[_textureUris.borders].textureObj,
			transparent: true
		});
		_bordersMesh = new THREE.Mesh(bordersGeom, bordersMat);

		_scene.add(_bordersMesh);
	}



	/*
	 * Creates the night lights mesh.
	 */
	function crteNightLightsMesh() {
		var lightsUniforms = {
			inpTexture: {type: "t", value: _textures[_textureUris.lights].textureObj},
			inpSunPos: {type: "v3", value: _sun.position},
			inpEarthTransform: {type: "m4", value: new THREE.Matrix4()}, // This matrix is just a placeholder for the moment.
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

		// Update the earth transform so that it matches that of an earth mesh. As the mesh is rotated in world space, this transform will reflect those rotations.
		lightsUniforms.inpEarthTransform.value = _lightsMesh.matrixWorld;
		lightsUniforms.inpEarthTransform.needsUpdate = true;

		_scene.add(_lightsMesh);
	}



	/*
	 * Creates the clouds mesh.
	 */
	function crteCloudsMesh() {
		var cloudsGeom = new THREE.SphereGeometry(EARTH_NBRS.RADIUS + 0.003, EARTH_NBRS.SEGMENTS, EARTH_NBRS.SEGMENTS);
		var cloudsMat = new THREE.MeshPhongMaterial({
			map: _textures[_textureUris.clouds].textureObj,
			transparent: true
		});
		_cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);

		_scene.add(_cloudsMesh);
	}



	/*
	 * Creates the stars mesh.
	 */
	function crteStarsMesh() {
		var starsGeom = new THREE.SphereGeometry(STARS_NBRS.RADIUS, STARS_NBRS.SEGMENTS, STARS_NBRS.SEGMENTS);
		var starsMat = new THREE.MeshBasicMaterial({
			map: _textures[_textureUris.stars].textureObj,
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
		document.getElementById("container").appendChild(_stats.domElement);
	}



	/*
	 * Initializes the GUI pane.
	 */
	function initGUI() {
		var gui = new dat.GUI();
		gui.close();  // Start the GUI in its closed position.

		_effectController = {
			displayTopoInd: true,
			displayBordersInd: true,
			displayNightLightsInd: true,
			displayCloudsInd: true
		};

		gui.add(_effectController, _controlNms.TOPO).name("Land & Water");
		gui.add(_effectController, _controlNms.BORDERS).name("Country Borders");
		gui.add(_effectController, _controlNms.LIGHTS).name("Night View");
		gui.add(_effectController, _controlNms.CLOUDS).name("Clouds");
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

		var deltaSecs = _clock.getDelta();

		_controls.update();

		_earthMesh.rotation.y = _bordersMesh.rotation.y = _lightsMesh.rotation.y += EARTH_NBRS.ROTATION_VELOCITY;
		_cloudsMesh.rotation.y += (EARTH_NBRS.ROTATION_VELOCITY * 1.05);


		if (_effectController.displayTopoInd) {
			_earthMesh.scale.copy(MESH_SCALE_VECTS.DISPLAY);
		} else {
			_earthMesh.scale.copy(MESH_SCALE_VECTS.HIDE);
		}

		if (_effectController.displayBordersInd) {
			_bordersMesh.scale.copy(MESH_SCALE_VECTS.DISPLAY);
		} else {
			_bordersMesh.scale.copy(MESH_SCALE_VECTS.HIDE);
		}

		if (_effectController.displayNightLightsInd) {
			_lightsMesh.scale.copy(MESH_SCALE_VECTS.DISPLAY);
		} else {
			_lightsMesh.scale.copy(MESH_SCALE_VECTS.HIDE);
		}

		if (_effectController.displayCloudsInd) {
			_cloudsMesh.scale.copy(MESH_SCALE_VECTS.DISPLAY);
		} else {
			_cloudsMesh.scale.copy(MESH_SCALE_VECTS.HIDE);
		}

		// Render
		_renderer.render(_scene, _camera);
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