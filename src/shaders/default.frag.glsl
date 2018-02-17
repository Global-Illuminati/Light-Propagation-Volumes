#version 300 es
precision highp float;

#include <common.glsl>

//
// NOTE: All fragment calculations are in *view space*
//

in vec3 v_position;
in vec3 v_normal;
in vec2 v_tex_coord;

#include <scene_uniforms.glsl>

uniform sampler2D u_diffuse_map;
uniform sampler2D u_specular_map;
uniform sampler2D u_normal_map;

uniform vec3 u_dir_light_color;
uniform vec3 u_dir_light_view_direction;

out vec4 o_color;

void main()
{
	vec3 N = normalize(v_normal);

	vec3 diffuse  = texture(u_diffuse_map, v_tex_coord).rgb;
	float shininess = texture(u_specular_map, v_tex_coord).r;

	vec3 wi = normalize(-u_dir_light_view_direction);
	vec3 wo = normalize(-v_position);

	float lambertian = saturate(dot(N, wi));

	//////////////////////////////////////////////////////////
	// ambient
	vec3 color = u_ambient_color.rgb * diffuse;

	//////////////////////////////////////////////////////////
	// directional light
	if (lambertian > 0.0)
	{
		vec3 wh = normalize(wi + wo);

		// diffuse
		color += diffuse * lambertian * u_dir_light_color;

		// specular
		float specular_angle = saturate(dot(N, wh));
		float specular_power = pow(2.0, 13.0 * shininess); // (fake glossiness from the specular map)
		float specular = pow(specular_angle, specular_power);
		color += shininess * specular * u_dir_light_color;
	}

	o_color = vec4(color, 1.0);
}
