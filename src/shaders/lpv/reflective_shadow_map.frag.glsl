#version 300 es
precision highp float;

layout(location = 0) out vec4 o_color_map;
layout(location = 1) out vec4 o_position_map;
layout(location = 2) out vec4 o_normal_map;

uniform sampler2D u_diffuse_map;
uniform bool u_is_directional_light;
uniform mat4 u_world_from_local;
uniform vec3 u_light_direction;
uniform vec3 u_light_color;
uniform vec3 u_spot_light_position;

in mat4 v_normal_matrix;
in vec4 v_world_space_position;
in vec3 v_normal;
in vec2 v_tex_coord;

#include <common.glsl>

//TODO: double check flux calculation
//#define USING_DIR_LIGHT


void main()
{
	vec3 diffuse = texture(u_diffuse_map, v_tex_coord).rgb;
	vec3 world_normal = u_light_color * normalize(v_normal_matrix * vec4(v_normal, 0.0)).xyz;
	float light_falloff = saturate(dot(-u_light_direction, world_normal));
	vec4 flux = vec4(0.0);

	if(u_is_directional_light)
		flux = vec4((u_light_color * diffuse), 1.0);
	else {
		vec3 light_to_frag = v_world_space_position.xyz - u_spot_light_position;
		float distance_attenuation = 1.0 / max(0.01, lengthSquared(light_to_frag));
		flux = vec4(u_light_color * diffuse * light_falloff * distance_attenuation , 1.0);
	}
	
	o_color_map = flux;
	o_position_map = v_world_space_position;
	o_normal_map = vec4(world_normal, 1.0);
}
