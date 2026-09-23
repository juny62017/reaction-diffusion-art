let gui_presets = {
  "preset": "Default",
  "remembered": {
    "Default": {
      "0": {
        "diffusion_scale": 0.625,
        "diffusion_scale_variation": 0.375,
        "feed": 0.042,
        "feed_variation": 0.001,
        "kill": 0.06,
        "kill_variation": 0.001,
        "anisotropy": 0.8,
        "environment_noise_scale": 250,
        "separate_fields": false,
        "substance_color": [
          168,
          0,
          0
        ],
        "background_color": [
          229,
          229,
          229
        ],
        "specular_color": [
          128,
          128,
          128
        ],
        "bump": 20,
        "shininess": 64,
        "light_height": 300,
        "simulation_iterations_per_frame": 4
      }
    },
    "Dunes/Zebra": {
      "0": {
        "diffusion_scale": 0.25,
        "diffusion_scale_variation": 0,
        "feed": 0.05,
        "feed_variation": 0,
        "kill": 0.061,
        "kill_variation": 0,
        "anisotropy": 0.9,
        "environment_noise_scale": 700,
        "separate_fields": true,
        "substance_color": [
          42.5,
          34.436283485562186,
          15.083363850911455
        ],
        "background_color": [
          152.5,
          134.62920684990445,
          76.54912911209405
        ],
        "specular_color": [
          12.5,
          12.5,
          12.5
        ],
        "bump": 10,
        "shininess": 8,
        "light_height": 300,
        "simulation_iterations_per_frame": 4
      }
    }
  },
  "closed": true,
  "folders": {
    "Diffusion Scale": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Feed": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Kill": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Environment": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Render Settings": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    }
  }
};

let reaction_diffusion_fragment = `

uniform sampler2D environment;

uniform float feed;
uniform float kill;
uniform float diffusion_scale;

uniform float feed_variation;
uniform float kill_variation;
uniform float diffusion_scale_variation;

uniform float anisotropy;
uniform bool separate_fields;

uniform vec2 mouse_pos;
uniform bool mouse_down;

uniform bool reset;

#define p2(v) v * v
#define PI 3.14159265358979323846

#define R 10.0

#define s(x, y) texture2D(reaction_diffusion, (gl_FragCoord.xy + vec2(x, y)) / resolution).xy

vec2 anisotropicDiffusion(vec2 angles, float a1, vec2 center)
{
  vec2
  v00 = s(-1, 1), v10 = s(0, 1), v20 = s(1, 1),
  v01 = s(-1, 0),                v21 = s(1, 0),
  v02 = s(-1,-1), v12 = s(0,-1), v22 = s(1,-1);

  vec2 cos_t = cos(angles);
  vec2 sin_t = sin(angles);

  vec2 cos2_t = p2(cos_t);
  vec2 sin2_t = p2(sin_t);

  float a2 = 1.0 - a1;

  vec2 d = 4.0 * (a2 - a1) * p2(cos_t * sin_t);
  vec2 h = 8.0 * (a1 * cos2_t + a2 * sin2_t);
  vec2 v = 8.0 * (a2 * cos2_t + a1 * sin2_t);

  return ((1.0 - d) * (v00 + v22) + (1.0 + d) * (v20 + v02) + h * (v01 + v21) + v * (v10 + v12) - 20.0 * center) / 6.0;
}

void main()
{
  vec4 env = texture2D(environment, (gl_FragCoord.xy / resolution).xy);

  float F = feed + env[0] * feed_variation;
  float K = kill + env[1] * kill_variation;
  float DS = diffusion_scale + env[2] * diffusion_scale_variation;
  vec2 angles = (1.0 + vec2(env[3], separate_fields ? env[0] : env[3])) * PI;

  vec2 old = s(0, 0);

  vec2 reaction = vec2(-1.0, 1.0) * old[0] * old[1] * old[1];

  vec2 dissipation = vec2(F * (1.0 - old[0]), -old[1] * (K + F));

  vec2 diffusion = anisotropicDiffusion(angles, anisotropy, old) * DS * vec2(1.0, 0.5);

  float dt = 1.0 / (4.0 * DS);

  gl_FragColor.xy = old + (reaction + dissipation + diffusion) * dt;

  if(mouse_down)
  {
    gl_FragColor[1] += max(0.25 - old[1], 0.0) * max(R - distance(gl_FragCoord.xy, mouse_pos), 0.0) / R;
  }

  if(reset)
  {
    gl_FragColor = vec4(0.0);
  }
}

`;

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

let gpu_compute = new THREE.GPUComputationRenderer(simulation_width, simulation_height, renderer);

let reaction_diffusion = gpu_compute.createTexture();

let reaction_diffusion_variable = gpu_compute.addVariable(
  "reaction_diffusion", 
  reaction_diffusion_fragment,
  reaction_diffusion
);

reaction_diffusion_variable.wrapS = THREE.ClampToEdgeWrapping;
reaction_diffusion_variable.wrapT = THREE.ClampToEdgeWrapping;

gpu_compute.setVariableDependencies(reaction_diffusion_variable, [reaction_diffusion_variable]);

reaction_diffusion_uniforms = reaction_diffusion_variable.material.uniforms;

reaction_diffusion_uniforms['mouse_pos'] = { value: new THREE.Vector2(-100, -100) };
reaction_diffusion_uniforms['mouse_down'] = { value: false };
reaction_diffusion_uniforms['feed'] = { value: Settings.feed };
reaction_diffusion_uniforms['kill'] = { value: Settings.kill };
reaction_diffusion_uniforms['diffusion_scale'] = { value: Settings.diffusion_scale };
reaction_diffusion_uniforms['feed_variation'] = { value: Settings.feed_variation };
reaction_diffusion_uniforms['kill_variation'] = { value: Settings.kill_variation };
reaction_diffusion_uniforms['diffusion_scale_variation'] = { value: Settings.diffusion_scale_variation };
reaction_diffusion_uniforms['anisotropy'] = { value: Settings.anisotropy };
reaction_diffusion_uniforms['reset'] = { value: false };
reaction_diffusion_uniforms['separate_fields'] = { value: Settings.separate_fields };

let light_element = document.getElementById('light');
let light_half_dim = light_element.clientWidth / 2;
updateLightPosition(new THREE.Vector2(width/2, height/2));

createEnvironment();

gpu_compute.init();

function animate() 
{
  requestAnimationFrame(animate);
  render();
}

animate();

function render()
{
  simulateReactionDiffusion(Settings.simulation_iterations_per_frame);
  material.uniforms.reaction_diffusion.value = gpu_compute.getCurrentRenderTarget(reaction_diffusion_variable).texture;

  renderer.render(scene, camera);

  if(render.save_image === true)
  {
    render.save_image = false;
    let save_link = document.getElementById('save-link');
    save_link.download = render.savename;
    save_link.href = renderer.domElement.toDataURL();
    save_link.click();
  }
}

function simulateReactionDiffusion(iterations)
{
  for(let i = 0; i < iterations; i++)
  {
    gpu_compute.compute();
  }
}

function updateLightPosition(pos)
{
  pos.x = (pos.x - light_half_dim <= 0) ? light_half_dim : 
         ((pos.x + light_half_dim >= width) ? width - light_half_dim : pos.x);

  pos.y = (pos.y - light_half_dim <= 0) ? light_half_dim :
         ((pos.y + light_half_dim >= height) ? height - light_half_dim : pos.y); 

  light_pos = pos;
  light_element.style.top = height - pos.y - light_half_dim + "px";
  light_element.style.left = pos.x - light_half_dim + "px";

  material.uniforms.light_pos.value.x = pos.x * (simulation_width / width);
  material.uniforms.light_pos.value.y = simulation_height - (height - pos.y) * (simulation_height / height);
}

function createEnvironment(update = true)
{
  if(!update && createEnvironment.prev_scale !== undefined && createEnvironment.prev_scale == Settings.environment_noise_scale)
  {
    return;
  }

  createEnvironment.prev_scale = Settings.environment_noise_scale;

  let simplex = new THREE.SimplexNoise();

  let offsets = new Array(4);
  for (let i = 0; i < 4; i++)
  {
    offsets[i] = (i + Math.random()) * 1000;
  }

  let inv_scale = 1.0 / Settings.environment_noise_scale;

  let pixels = new Float32Array(simulation_width * simulation_height * 4);
  for (let y = 0; y < simulation_height; y++)
  {
    for (let x = 0; x < simulation_width; x++)
    {
      for (let i = 0; i < 4; i++)
      {
        pixels[(y * simulation_width + x) * 4 + i] = simplex.noise3d((x + 0.5) * inv_scale, (y + 0.5) * inv_scale, offsets[i]);
      }
    }
  }

  reaction_diffusion_uniforms['environment'] = { 
    value: new THREE.DataTexture(pixels, simulation_width, simulation_height, THREE.RGBAFormat, THREE.FloatType) 
  };

  reaction_diffusion_uniforms.environment.value.magFilter = THREE.LinearFilter;
  reaction_diffusion_uniforms.environment.value.minFilter = THREE.LinearFilter;
}