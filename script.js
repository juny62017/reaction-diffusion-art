let render_vertex = `
  void main()
  {
    gl_Position = vec4(position, 1.0);
  }

`;

let render_fragment = `

  uniform sampler2D reaction_diffusion;
  uniform vec3 light_pos;

  uniform vec3 substance_color;
  uniform vec3 background_color;
  uniform vec3 specular_color;

  uniform float shininess;

  uniform float bump;

  #define edge0 0.15
  #define edge1 0.19
  #define ambient 0.1

  #define H(x, y) texture2D(reaction_diffusion, (frag2sim * gl_FragCoord.xy + vec2(x, y)) / simulation_resolution).g

  void main()
  {
    vec3 normal = normalize(vec3(H(-1, 0) - H(1, 0), H(0, -1) - H(0, 1), 2.0 / bump));

    float h = H(0, 0);

    vec3 pos = vec3(frag2sim * gl_FragCoord.xy, h * bump);
    vec3 light_dir = normalize(light_pos - pos);

    float foregroundness = smoothstep(edge0, edge1, h);

    vec3 diffuse_color = mix(background_color, substance_color, foregroundness);

    float cos_theta = dot(normal, light_dir);

    if(cos_theta < 0.0)
    {
      gl_FragColor = vec4(ambient * diffuse_color, 1);
    }
    else
    {
      float reflect_z = max(2.0 * cos_theta * normal.z - light_dir.z, 0.0);
      vec3 specular = pow(reflect_z, shininess) * foregroundness * specular_color;
      gl_FragColor = vec4((ambient + cos_theta) * diffuse_color + specular, 1);
    }
  }

`;

function Settings()
{
  Settings.anisotropy = 0.8;
  Settings.simulation_iterations_per_frame = 4;
  Settings.environment_noise_scale = 250;
  Settings.background_color = [229, 229, 229];
  Settings.substance_color = [50, 158, 168];
  Settings.specular_color = [128, 128, 128];
  Settings.shininess = 64.0;
  Settings.light_height = 300;
  Settings.bump = 20;
  Settings.separate_fields = false;
  Settings.diffusion_scale = 0.625;
  Settings.diffusion_scale_variation = 0.375;
  Settings.feed = 0.042;
  Settings.feed_variation = 0.001;
  Settings.kill = 0.06;
  Settings.kill_variation = 0.001;
}

let width = window.innerWidth;
let height = window.innerHeight;

let actual_width = Math.round(width * window.devicePixelRatio);
let actual_height = Math.round(height * window.devicePixelRatio);

let simulation_width = Math.round(actual_width / 2.5);
let simulation_height = Math.round(actual_height / 2.5);

Settings();

let scene = new THREE.Scene();

let camera = new THREE.Camera();
camera.position.z = 1;

let renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

let light_pos = new THREE.Vector2(simulation_width/2, simulation_height/2);
let light_enabled = false;
let mouse_down = false;
let light_move = false;
let brush_move = false;

let material = new THREE.ShaderMaterial
({ 
  vertexShader: render_vertex,
  fragmentShader: render_fragment,
  uniforms: { 
    "reaction_diffusion": { value: null }, 
    "light_pos": { value: new THREE.Vector3(light_pos.x, light_pos.y, Settings.light_height) },
    "substance_color": { value: new THREE.Vector3().fromArray(Settings.substance_color).divideScalar(255) },
    "background_color": { value: new THREE.Vector3().fromArray(Settings.background_color).divideScalar(255) },
    "specular_color": { value: new THREE.Vector3().fromArray(Settings.specular_color).divideScalar(255) },
    "shininess": { value: Settings.shininess },
    "bump": { value: Settings.bump }
  },
  defines: {
    frag2sim: 'vec2(' +  simulation_width / actual_width + ', ' + simulation_height / actual_height + ')',
    simulation_resolution: 'vec2(' + simulation_width + ', ' + simulation_height + ')'
  }
});
scene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), material));

