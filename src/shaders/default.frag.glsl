#version 300 es
precision highp float;

#include <common.glsl>
#include <lpv_common.glsl>

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

struct SpotLight {
	vec3  color;
	float cone;
	vec3  view_position;
	vec3  view_direction;
};

#define NUM_SPOTLIGHTS 2
uniform SpotLight[NUM_SPOTLIGHTS] u_spot_light;

// Light Propagation Volumes uniforms
uniform int u_lpv_grid_size;
uniform float u_indirect_light_attenuation;

uniform bool u_render_direct_light;
uniform bool u_render_indirect_light;

uniform sampler2D u_red_indirect_light;
uniform sampler2D u_green_indirect_light;
uniform sampler2D u_blue_indirect_light;

layout(location = 0) out vec4 o_color;

vec4 sample_grid_trilinear(in sampler2D t, vec3 texCoord) {
	ivec3 x0y0z0 = ivec3(floor(texCoord.x), floor(texCoord.y), floor(texCoord.z));
	ivec2 fetchCoords = ivec2(x0y0z0.x + (x0y0z0.z * u_lpv_grid_size), x0y0z0.y);

	vec4 bl1 = texelFetch(t, fetchCoords, 0);
	vec4 br1 = texelFetch(t, fetchCoords + ivec2(1,0), 0);

	vec4 tl1 = texelFetch(t, fetchCoords + ivec2(0,1), 0);
	vec4 tr1 = texelFetch(t, fetchCoords + ivec2(1,1), 0);

	vec4 b1 = mix(bl1, br1, texCoord.x - float(x0y0z0.x));
	vec4 t1 = mix(tl1, tr1, texCoord.x - float(x0y0z0.x));
	vec4 r1 = mix(b1, t1, texCoord.y - float(x0y0z0.y));

	fetchCoords = ivec2(x0y0z0.x + ((x0y0z0.z + 1) * u_lpv_grid_size), x0y0z0.y);

	vec4 bl2 = texelFetch(t, fetchCoords, 0);
	vec4 br2 = texelFetch(t, fetchCoords + ivec2(1,0), 0);

	vec4 tl2 = texelFetch(t, fetchCoords + ivec2(0,1), 0);
	vec4 tr2 = texelFetch(t, fetchCoords + ivec2(1,1), 0);

	vec4 b2 = mix(bl2, br2, texCoord.x - float(x0y0z0.x));
	vec4 t2 = mix(tl2, tr2, texCoord.x - float(x0y0z0.x));
	vec4 r2 = mix(b2, t2, texCoord.y - float(x0y0z0.y));

	return mix(r1, r2, texCoord.z - float(x0y0z0.z));
}

vec3 get_lpv_intensity()
{
	vec4 sh_intensity = dirToSH(-v_world_space_normal);
	vec3 grid_cell = getGridCellf(v_world_space_position.xyz, u_lpv_grid_size);

	vec4 red_light = sample_grid_trilinear(u_red_indirect_light, grid_cell);
	vec4 green_light = sample_grid_trilinear(u_green_indirect_light, grid_cell);
	vec4 blue_light = sample_grid_trilinear(u_blue_indirect_light, grid_cell);

	// Dot with sh coeffiencients to get directioal light intesity from the normal
	return vec3(dot(sh_intensity, red_light), dot(sh_intensity, green_light), dot(sh_intensity, blue_light));
}

void main()
{
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

	vec3 lpv_intensity = get_lpv_intensity();
	vec3 lpv_radiance = vec3(max(0.0, lpv_intensity.r), max(0.0, lpv_intensity.g), max(0.0, lpv_intensity.b)) / PI;
	vec3 indirect_light = diffuse * lpv_radiance;

	vec3 wi = normalize(-u_dir_light_view_direction);
	vec3 wo = normalize(-v_position);

	float lambertian = saturate(dot(N, wi));

	//////////////////////////////////////////////////////////
	// Ambient
	vec3 color = u_ambient_color.rgb * diffuse;

	//////////////////////////////////////////////////////////
	// Directional light

	// Shadow visibility
	// TODO: Probably don't hardcode bias
	// TODO: Send in shadow map pixel size as a uniform
	const float bias = 0.0029;
	vec2 texel_size = vec2(1.0) / vec2(textureSize(u_shadow_map, 0));
	vec3 light_space = v_light_space_position.xyz / v_light_space_position.w;
	float visibility = sample_shadow_map_pcf(u_shadow_map, light_space.xy, light_space.z, texel_size, bias);

	if (lambertian > 0.0 && visibility > 0.0)
	{
		vec3 wh = normalize(wi + wo);

		// Diffuse
		color += visibility * diffuse * lambertian * u_dir_light_color;

		// Specular
		float specular_angle = saturate(dot(N, wh));
		float specular_power = pow(2.0, 13.0 * shininess); // (fake glossiness from the specular map)
		float specular = pow(specular_angle, specular_power);
		color += visibility * shininess * specular * u_dir_light_color;
	}

	//////////////////////////////////////////////////////////
	// spot light
	for(int i = 0; i < NUM_SPOTLIGHTS; i++)
	{
		vec3 light_to_frag = v_position - u_spot_light[i].view_position;
		float distance_attenuation = 1.0 / max(0.01, lengthSquared(light_to_frag));

		vec3 wi = normalize(-light_to_frag);
		float lambertian = saturate(dot(N, wi));

		const float smoothing = 0.15;
		float inner = u_spot_light[i].cone - smoothing;
		float outer = u_spot_light[i].cone;
		float cone_attenuation = 1.0 - smoothstep(inner, outer, 1.0 - dot(-wi, u_spot_light[i].view_direction));

		if (lambertian > 0.0 && cone_attenuation > 0.0)
		{
			vec3 wh = normalize(wi + wo);

			// diffuse
			color += diffuse * distance_attenuation * cone_attenuation * lambertian * u_spot_light[i].color;

			// specular
			float specular_angle = saturate(dot(N, wh));
			float specular_power = pow(abs(2.0), 13.0 * shininess);
			float specular = pow(abs(specular_angle), specular_power);
			color += shininess * distance_attenuation * cone_attenuation * specular * u_spot_light[i].color;
		}
	}

	// Output tangents
	if(u_render_direct_light && u_render_indirect_light)
		o_color = vec4(color, 1.0) + vec4(indirect_light, 1.0) * u_indirect_light_attenuation;
	else if (u_render_indirect_light)
		o_color = vec4(indirect_light, 1.0) * u_indirect_light_attenuation;
	else if (u_render_direct_light)
		o_color = vec4(color, 1.0);
	else 
		o_color = vec4(0.0,0.0,0.0,1.0);

}
