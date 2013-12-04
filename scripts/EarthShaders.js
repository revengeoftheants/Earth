/**
 * @author mikael emtinger / http://gomo.se/
 */

EarthShaders = {

	'nightLights': {

		vertexShader: [

			"uniform vec3 inpSunPos;",
			"uniform mat4 inpEarthTransform;",
			"uniform mat4 inpSunTransform;",

			"varying vec2 vUV;",
			"varying vec3 vNormal;",
			"varying vec3 transformedSunPos;",

			"void main() {",

				"vUV = uv;",

				// Apply the Earth's world transform to its vertex normals to account for its position and orientation in space.
				"vec4 normal4 = inpEarthTransform * vec4(normal, 1.0);",
				"vNormal = normal4.xyz;",

				// Apply the sun's world transform to its vertex normals to account for its position and orientation in space.
				"vec4 sunlightDir4 = inpSunTransform * vec4(inpSunPos, 1.0);",
				"transformedSunPos = sunlightDir4.xyz;",

				// Set the screen position of the current vertex.
				"vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
				"gl_Position = projectionMatrix * mvPosition;",

			"}"

		].join( "\n" ),

		fragmentShader: [

			"uniform sampler2D inpTexture;",

			"varying vec2 vUV;",
			"varying vec3 vNormal;",
			"varying vec3 transformedSunPos;",

			"void main() {",

				// Calculate the dot product of the sunlight to the vertex normal
				"float dProd = dot(vNormal, transformedSunPos);",
				"vec4 color = texture2D( inpTexture, vUV );",

				"if( dProd >= 0.0 ) {",
					// If the vertex is covered by sunlight, do not display the lights texture on it.
					"color.a = 0.0;",
				"}",

				"gl_FragColor = color;",
			"}"
		].join( "\n" )

	}

};
