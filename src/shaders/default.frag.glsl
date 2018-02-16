#version 300 es
precision highp float;

//
// NOTE: All fragment calculations are in world space! (for now)
//

in vec3 v_position;
in vec3 v_normal;
in vec2 v_tex_coord;

layout(std140) uniform SceneUniforms {
	vec4 u_ambient_color;
	//
	vec4 u_directional_light_color;
	vec4 u_directional_light_direction;
};

uniform sampler2D u_texture;

out vec4 o_color;

void main()
{
	vec3 packed_normal = v_normal * vec3(0.5) + vec3(0.5);
	//vec3 base_color = packed_normal;
	vec3 base_color = texture(u_texture, v_tex_coord).rgb;

	vec3 color = vec3(0, 0, 0);

	// Add ambient term
	color += u_ambient_color.rgb * base_color;

	// Apply directional light shading
	{
		float amount = max(0.0, dot(v_normal, -u_directional_light_direction.xyz));
		color += amount * base_color * u_directional_light_color.rgb;
	}

	o_color = vec4(color, 1.0);
}
