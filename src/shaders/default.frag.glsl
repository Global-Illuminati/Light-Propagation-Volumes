#version 300 es
precision highp float;

#include <common.glsl>

#define CELLSIZE 4.0

#define SH_C0 0.282094791f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2 
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3)

//
// NOTE: All fragment calculations are in *view space*
//

in vec3 v_position;
in vec3 v_normal;
in vec3 v_tangent;
in vec3 v_bitangent;
in vec2 v_tex_coord;
in vec4 v_light_space_position;
in vec4 v_world_space_position;
in vec3 v_world_space_normal;

#include <scene_uniforms.glsl>

uniform sampler2D u_diffuse_map;
uniform sampler2D u_specular_map;
uniform sampler2D u_normal_map;
uniform sampler2D u_shadow_map;


uniform vec3 u_dir_light_color;
uniform vec3 u_dir_light_view_direction;

//Light Propagation Volumes uniforms
uniform int u_texture_size;
uniform sampler2D u_red_indirect_light;
uniform sampler2D u_green_indirect_light;
uniform sampler2D u_blue_indirect_light;

layout(location = 0) out vec4 o_color;

ivec3 getGridCell(vec3 pos) 
{
	const vec3 center = vec3(0);
	vec3 maxGridSize = vec3(u_texture_size);
	vec3 min = center - vec3(maxGridSize * 0.5 * CELLSIZE);
	return ivec3((pos - min) / CELLSIZE);
}

vec2 getGridTexCoord(vec3 pos)
{
	ivec3 gridCell = getGridCell(pos);
	float f_texture_size = float(u_texture_size);
	//displace int coordinates with 0.5
	vec2 texCoords = vec2((gridCell.x % u_texture_size) + u_texture_size * gridCell.z, gridCell.y) + vec2(0.5);
	//get texture space coordinates
	vec2 texCoord = vec2((texCoords.x) / (f_texture_size * f_texture_size), (texCoords.y) / f_texture_size);
	return texCoord;
}

// Get SH coefficients out of direction
vec4 dirToSH(vec3 dir)
{
    return vec4(SH_C0, -SH_C1 * dir.y, SH_C1 * dir.z, -SH_C1 * dir.x);
}

vec3 getLPVIntensity()
{
	vec2 gridTexCoord = getGridTexCoord(v_world_space_position.xyz);
	vec4 shIntensity = dirToSH(-v_world_space_normal);

	vec4 redLight = texture(u_red_indirect_light, gridTexCoord);
	vec4 greenLight = texture(u_green_indirect_light, gridTexCoord);
	vec4 blueLight = texture(u_blue_indirect_light, gridTexCoord);

	//dot with sh coeffiencients to get directioal light intesity from the normal
	return vec3(dot(shIntensity, redLight), dot(shIntensity, greenLight), dot(shIntensity, blueLight));
}

//#define DEBUG_LPV

void main()
{
	vec3 lpv_intensity = getLPVIntensity();
	vec3 lpv_radiance = vec3(max(0.0, lpv_intensity.r), max(0.0, lpv_intensity.g), max(0.0, lpv_intensity.b));

	vec3 N = normalize(v_normal);
	vec3 T = normalize(v_tangent);
	vec3 B = normalize(v_bitangent);

	// NOTE: We probably don't really need all (or any) of these
	reortogonalize(N, T);
	reortogonalize(N, B);
	reortogonalize(T, B);
	mat3 tbn = mat3(T, B, N);

	// Rotate normal map normals from tangent space to view space (normal mapping)
	vec3 mapped_normal = texture(u_normal_map, v_tex_coord).xyz;
	mapped_normal = normalize(mapped_normal * vec3(2.0) - vec3(1.0));
	N = tbn * mapped_normal;

	vec3 diffuse = texture(u_diffuse_map, v_tex_coord).rgb;
	float shininess = texture(u_specular_map, v_tex_coord).r;

	vec3 wi = normalize(-u_dir_light_view_direction);
	vec3 wo = normalize(-v_position);

	float lambertian = saturate(dot(N, wi));

	//////////////////////////////////////////////////////////
	// ambient
	vec3 color = u_ambient_color.rgb * diffuse;

	//////////////////////////////////////////////////////////
	// directional light

	// shadow visibility
	// TODO: Probably don't hardcode bias
	// TODO: Send in shadow map pixel size as a uniform
	const float bias = 0.0029;
	vec2 texel_size = vec2(1.0) / vec2(textureSize(u_shadow_map, 0));
	vec3 light_space = v_light_space_position.xyz / v_light_space_position.w;
	float visibility = sample_shadow_map_pcf(u_shadow_map, light_space.xy, light_space.z, texel_size, bias);

	if (lambertian > 0.0 && visibility > 0.0)
	{
		vec3 wh = normalize(wi + wo);

		// diffuse
		color += visibility * diffuse * lambertian * u_dir_light_color;

		// specular
		float specular_angle = saturate(dot(N, wh));
		float specular_power = pow(2.0, 13.0 * shininess); // (fake glossiness from the specular map)
		float specular = pow(specular_angle, specular_power);
		color += visibility * shininess * specular * u_dir_light_color;
	}

	// output tangents
	#ifdef DEBUG_LPV
		o_color = vec4(lpv_radiance, 1.0) * 3.0;
	#else
		o_color = vec4(color, 1.0);
	#endif

}
